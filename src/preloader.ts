/**
 * Image preloading utilities with retry/backoff, priority, cache limits, and eviction.
 */

export interface PreloadOptions {
  /** Max retries on failure. Default 2. */
  retries?: number;
  /** Initial backoff ms. Default 500. */
  backoffMs?: number;
  /** Max backoff ms. Default 5000. */
  maxBackoffMs?: number;
  /** Priority (higher = load first). Default 0. */
  priority?: number;
}

export interface PreloaderConfig {
  /** Max number of cached images. Evicts oldest when exceeded. Default 100. */
  maxCacheSize?: number;
  /** Eviction strategy: 'oldest' | 'leastRecentlyUsed'. Default 'leastRecentlyUsed'. */
  evictionStrategy?: 'oldest' | 'leastRecentlyUsed';
}

interface CacheEntry {
  img: HTMLImageElement;
  lastAccess: number;
  url: string;
}

const imageCache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];
let config: Required<PreloaderConfig> = {
  maxCacheSize: 100,
  evictionStrategy: 'leastRecentlyUsed',
};

function normalizePreloadOptions(options: PreloadOptions): Required<PreloadOptions> {
  const retries = Number.isFinite(Number(options.retries)) ? Math.max(0, Math.floor(Number(options.retries))) : 2;
  const backoffMs = Number.isFinite(Number(options.backoffMs)) ? Math.max(0, Number(options.backoffMs)) : 500;
  const maxBackoffMs = Number.isFinite(Number(options.maxBackoffMs)) ? Math.max(0, Number(options.maxBackoffMs)) : 5000;
  const priority = Number.isFinite(Number(options.priority)) ? Number(options.priority) : 0;
  return {
    retries,
    backoffMs,
    maxBackoffMs: Math.max(backoffMs, maxBackoffMs),
    priority,
  };
}

/**
 * Configure the global preloader (cache size, eviction).
 */
export function configurePreloader(options: PreloaderConfig): void {
  const maxCacheSize = Number.isFinite(Number(options.maxCacheSize))
    ? Math.max(1, Math.floor(Number(options.maxCacheSize)))
    : config.maxCacheSize;
  const evictionStrategy = options.evictionStrategy === 'oldest' || options.evictionStrategy === 'leastRecentlyUsed'
    ? options.evictionStrategy
    : config.evictionStrategy;
  config = { ...config, maxCacheSize, evictionStrategy };
}

function evictOne(): void {
  if (imageCache.size < config.maxCacheSize) return;
  if (config.evictionStrategy === 'oldest') {
    const first = accessOrder[0];
    if (first) {
      accessOrder.shift();
      imageCache.delete(first);
    }
  } else {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const url of accessOrder) {
      const entry = imageCache.get(url);
      if (entry && entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = url;
      }
    }
    if (oldestKey) {
      const idx = accessOrder.indexOf(oldestKey);
      if (idx >= 0) accessOrder.splice(idx, 1);
      imageCache.delete(oldestKey);
    }
  }
}

function touch(url: string): void {
  const entry = imageCache.get(url);
  if (entry) {
    entry.lastAccess = Date.now();
    const i = accessOrder.indexOf(url);
    if (i >= 0) accessOrder.splice(i, 1);
    accessOrder.push(url);
  }
}

/**
 * Preload a single image with optional retry/backoff.
 */
export function preloadImage(
  url: string,
  options: PreloadOptions = {}
): Promise<HTMLImageElement> {
  const opts = normalizePreloadOptions(options);

  if (imageCache.has(url)) {
    const entry = imageCache.get(url)!;
    touch(url);
    if (entry.img.complete && entry.img.naturalWidth > 0) {
      return Promise.resolve(entry.img);
    }
    return new Promise((resolve, reject) => {
      entry.img.onload = () => {
        touch(url);
        resolve(entry.img);
      };
      entry.img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    });
  }

  function attempt(attemptIndex: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        evictOne();
        const entry: CacheEntry = { img, lastAccess: Date.now(), url };
        imageCache.set(url, entry);
        accessOrder.push(url);
        resolve(img);
      };
      img.onerror = () => {
        if (attemptIndex < opts.retries) {
          const delay = Math.min(
            opts.maxBackoffMs,
            opts.backoffMs * Math.pow(2, attemptIndex)
          );
          setTimeout(() => {
            attempt(attemptIndex + 1).then(resolve).catch(reject);
          }, delay);
        } else {
          reject(new Error(`Failed to load image after ${opts.retries + 1} attempts: ${url}`));
        }
      };
      img.src = url;
    });
  }

  return attempt(0);
}

/**
 * Preload multiple images with concurrency and optional priority.
 */
export async function preloadImages(
  urls: string[],
  concurrency = 3,
  options: PreloadOptions = {}
): Promise<HTMLImageElement[]> {
  const opts = normalizePreloadOptions(options);
  const safeConcurrency = Number.isFinite(Number(concurrency))
    ? Math.max(1, Math.floor(Number(concurrency)))
    : 3;
  const withPriority = urls.map((url, i) => ({ url, priority: opts.priority, index: i }));
  withPriority.sort((a, b) => b.priority - a.priority);
  const sortedUrls = withPriority.map((x) => x.url);
  const results: (HTMLImageElement | null)[] = new Array(urls.length);
  const queue = [...sortedUrls];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) continue;
      try {
        const img = await preloadImage(url, opts);
        const idx = urls.indexOf(url);
        if (idx >= 0) results[idx] = img;
      } catch (err) {
        console.warn(`[flicker] Failed to preload: ${url}`, err);
      }
    }
  }

  const workers = Array(Math.min(safeConcurrency, sortedUrls.length))
    .fill(null)
    .map(() => worker());
  await Promise.all(workers);
  return results.filter((r): r is HTMLImageElement => r != null);
}

/**
 * Preload images starting from an index, loading 'ahead' number of images.
 */
export async function preloadAhead(
  urls: string[],
  startIndex: number,
  ahead: number,
  loop = true
): Promise<HTMLImageElement[]> {
  if (urls.length === 0 || ahead <= 0) return [];

  const length = urls.length;
  const normalizeIndex = (index: number) => ((index % length) + length) % length;
  const toLoad: string[] = [];
  for (let i = 0; i < ahead; i++) {
    let index = startIndex + i;
    if (loop) index = normalizeIndex(index);
    else if (index >= length) break;
    else if (index < 0) continue;
    const nextUrl = urls[index];
    if (nextUrl) toLoad.push(nextUrl);
  }
  return preloadImages(toLoad);
}

/**
 * Check if an image is cached.
 */
export function isImageCached(url: string): boolean {
  const entry = imageCache.get(url);
  const ok = entry ? entry.img.complete && entry.img.naturalWidth > 0 : false;
  if (ok) touch(url);
  return ok;
}

/**
 * Clear the image cache.
 */
export function clearImageCache(url?: string): void {
  if (url) {
    imageCache.delete(url);
    const i = accessOrder.indexOf(url);
    if (i >= 0) accessOrder.splice(i, 1);
  } else {
    imageCache.clear();
    accessOrder.length = 0;
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): { size: number; urls: string[]; maxSize: number } {
  return {
    size: imageCache.size,
    maxSize: config.maxCacheSize,
    urls: Array.from(imageCache.keys()),
  };
}

/**
 * Evict stale entries older than maxAgeMs (optional manual eviction).
 */
export function evictStale(maxAgeMs: number): number {
  const now = Date.now();
  let count = 0;
  for (const url of Array.from(imageCache.keys())) {
    const entry = imageCache.get(url);
    if (entry && now - entry.lastAccess > maxAgeMs) {
      imageCache.delete(url);
      const i = accessOrder.indexOf(url);
      if (i >= 0) accessOrder.splice(i, 1);
      count++;
    }
  }
  return count;
}
