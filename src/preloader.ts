/**
 * Image preloading utilities for smooth transitions.
 */

/** Cache of preloaded images. */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Preload a single image.
 * @param url - Image URL to preload.
 * @returns Promise that resolves with the loaded image, rejects on error.
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(url)) {
    const cached = imageCache.get(url)!;
    if (cached.complete && cached.naturalWidth > 0) {
      return Promise.resolve(cached);
    }
    // If cached but not loaded, wait for it
    return new Promise((resolve, reject) => {
      cached.onload = () => resolve(cached);
      cached.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Preload multiple images.
 * @param urls - Array of image URLs.
 * @param concurrency - Number of concurrent loads. Default: 3.
 * @returns Promise that resolves when all images are loaded.
 */
export async function preloadImages(urls: string[], concurrency = 3): Promise<HTMLImageElement[]> {
  const results: HTMLImageElement[] = [];
  const queue = [...urls];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) continue;
      try {
        const img = await preloadImage(url);
        results.push(img);
      } catch (err) {
        // Continue with other images
        console.warn(`[flicker] Failed to preload: ${url}`, err);
      }
    }
  }

  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Preload images starting from an index, loading 'ahead' number of images.
 * @param urls - Array of all image URLs.
 * @param startIndex - Index to start from.
 * @param ahead - Number of images to preload ahead.
 * @param loop - Whether to wrap around to beginning.
 * @returns Promise that resolves when images are loaded.
 */
export async function preloadAhead(
  urls: string[],
  startIndex: number,
  ahead: number,
  loop = true
): Promise<HTMLImageElement[]> {
  const toLoad: string[] = [];

  for (let i = 0; i < ahead; i++) {
    let index = startIndex + i;
    if (loop) {
      index = index % urls.length;
    } else if (index >= urls.length) {
      break;
    }
    toLoad.push(urls[index]);
  }

  return preloadImages(toLoad);
}

/**
 * Check if an image is cached.
 * @param url - Image URL.
 * @returns True if cached and loaded.
 */
export function isImageCached(url: string): boolean {
  const img = imageCache.get(url);
  return img ? img.complete && img.naturalWidth > 0 : false;
}

/**
 * Clear the image cache.
 * @param url - Optional specific URL to clear. If omitted, clears all.
 */
export function clearImageCache(url?: string): void {
  if (url) {
    imageCache.delete(url);
  } else {
    imageCache.clear();
  }
}

/**
 * Get cache statistics.
 * @returns Object with cache info.
 */
export function getCacheStats(): { size: number; urls: string[] } {
  return {
    size: imageCache.size,
    urls: Array.from(imageCache.keys()),
  };
}
