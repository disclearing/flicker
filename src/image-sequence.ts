import type {
  ImageSequenceOptions,
  ImageSequenceController,
  ImageTransition,
} from './types.js';
import { preloadImage, isImageCached } from './preloader.js';
import { schedule, prefersReducedMotion, subscribeVisibility } from './engine.js';
import { runTransition } from './plugins.js';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNextInterval(opts: ImageSequenceOptions): number {
  if (opts.randomInterval && opts.minInterval != null && opts.maxInterval != null) {
    return opts.minInterval + Math.random() * (opts.maxInterval - opts.minInterval);
  }
  return opts.interval ?? 1000;
}

/**
 * Create an image sequence controller that cycles through multiple images.
 * Supports transitions, preloading, shuffling, and looping.
 */
export function createImageSequence(
  element: HTMLImageElement,
  options: ImageSequenceOptions
): ImageSequenceController {
  if (!options.images || options.images.length === 0) {
    throw new Error('ImageSequenceOptions.images must contain at least one image URL');
  }

  let opts: ImageSequenceOptions = {
    interval: 1000,
    minInterval: 500,
    maxInterval: 2000,
    randomInterval: false,
    transition: 'instant',
    transitionDuration: 300,
    loop: true,
    shuffle: false,
    startIndex: 0,
    direction: 1,
    preload: true,
    preloadAhead: 2,
    ...options,
  };

  let images = opts.shuffle ? shuffleArray(options.images) : [...options.images];
  let currentIndex = Math.max(0, Math.min(opts.startIndex ?? 0, images.length - 1));
  let running = false;
  let paused = false;
  let visibilityPaused = false;
  let cancelSchedule: (() => void) | null = null;
  let startTime = 0;
  let runToken = 0;
  let destroyed = false;
  let unsubscribeVisibility: (() => void) | null = null;

  const engine = opts.engine ?? 'timeout';
  const respectReducedMotion = opts.respectReducedMotion ?? true;
  const autoPauseOnHidden = opts.autoPauseOnHidden ?? true;
  const reducedMotionActive = respectReducedMotion && prefersReducedMotion();

  const isPaused = () => paused || visibilityPaused;

  // Set initial image
  if (images.length > 0) {
    element.src = images[currentIndex];
  }

  // Preload ahead
  async function doPreload(): Promise<void> {
    if (!opts.preload) return;
    const ahead = opts.preloadAhead ?? 2;
    const indices: number[] = [];
    for (let i = 1; i <= ahead; i++) {
      const idx = (currentIndex + i * (opts.direction ?? 1)) % images.length;
      indices.push(idx < 0 ? idx + images.length : idx);
    }
    const toLoad = indices.map((i) => images[i]).filter((url) => !isImageCached(url));
    if (toLoad.length > 0) {
      await Promise.allSettled(toLoad.map((url) => preloadImage(url)));
    }
  }

  const showNext = async (): Promise<void> => {
    if (destroyed || !running || isPaused() || !element.isConnected) return;
    const currentRun = runToken;

    const direction = opts.direction ?? 1;
    let nextIndex = currentIndex + direction;

    if (nextIndex >= images.length) {
      if (opts.loop) {
        opts.onLoop?.();
        nextIndex = 0;
      } else {
        opts.onComplete?.();
        running = false;
        opts.onStop?.();
        return;
      }
    } else if (nextIndex < 0) {
      if (opts.loop) {
        opts.onLoop?.();
        nextIndex = images.length - 1;
      } else {
        opts.onComplete?.();
        running = false;
        opts.onStop?.();
        return;
      }
    }

    const nextUrl = images[nextIndex];
    opts.onTransitionStart?.(currentIndex, nextIndex);

    // Ensure image is loaded before transition
    try {
      await preloadImage(nextUrl);
    } catch (err) {
      opts.onError?.(nextUrl, err as Error);
    }
    if (!running || isPaused() || !element.isConnected || currentRun !== runToken) return;

    // Apply transition (built-in or plugin)
    await runTransition(
      element,
      nextUrl,
      opts.transition ?? 'instant',
      opts.transitionDuration ?? 300
    );
    if (!running || isPaused() || !element.isConnected || currentRun !== runToken) return;

    currentIndex = nextIndex;
    opts.onTransitionEnd?.(currentIndex);
    opts.onChange?.(currentIndex, images.length, images[currentIndex]);

    // Check duration
    if (opts.duration != null && Date.now() - startTime >= opts.duration) {
      running = false;
      opts.onStop?.();
      return;
    }

    // Preload next batch
    void doPreload();

    // Schedule next
    const nextInterval = getNextInterval(opts);
    cancelSchedule = schedule(() => void showNext(), nextInterval, { engine });
  };

  const controller: ImageSequenceController = {
    get isRunning() {
      return running;
    },
    get isPaused() {
      return paused || visibilityPaused;
    },
    get currentIndex() {
      return currentIndex;
    },
    get totalImages() {
      return images.length;
    },
    get currentImage() {
      return images[currentIndex] ?? null;
    },

    start() {
      if (running) return;
      running = true;
      paused = false;
      runToken++;
      startTime = Date.now();
      opts.onStart?.();
      if (autoPauseOnHidden && typeof document !== 'undefined') {
        unsubscribeVisibility = subscribeVisibility((visibleTab) => {
          opts.onVisibilityChange?.(visibleTab);
          if (visibleTab) {
            if (visibilityPaused && running && !paused) {
              visibilityPaused = false;
              opts.onResume?.();
              const interval = getNextInterval(opts);
              cancelSchedule = schedule(() => void showNext(), interval, { engine });
            }
          } else {
            if (running && !visibilityPaused) {
              visibilityPaused = true;
              cancelSchedule?.();
              cancelSchedule = null;
              opts.onPause?.();
            }
          }
        });
      }
      if (reducedMotionActive) {
        running = false;
        opts.onStop?.();
        return;
      }
      void doPreload();
      const interval = getNextInterval(opts);
      cancelSchedule = schedule(() => void showNext(), interval, { engine });
    },

    stop() {
      running = false;
      paused = false;
      runToken++;
      cancelSchedule?.();
      cancelSchedule = null;
      opts.onStop?.();
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      runToken++;
      cancelSchedule?.();
      cancelSchedule = null;
      opts.onPause?.();
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      runToken++;
      opts.onResume?.();
      const interval = getNextInterval(opts);
      cancelSchedule = schedule(() => void showNext(), interval, { engine });
    },

    jumpTo(index: number) {
      if (index < 0 || index >= images.length) return;
      currentIndex = index;
      element.src = images[currentIndex];
      opts.onChange?.(currentIndex, images.length, images[currentIndex]);
      void doPreload();
    },

    next() {
      if (images.length === 0) return;
      const atEnd = currentIndex >= images.length - 1;
      if (atEnd && !opts.loop) return;
      const nextIdx = atEnd ? 0 : currentIndex + 1;
      this.jumpTo(nextIdx);
    },

    previous() {
      if (images.length === 0) return;
      const atStart = currentIndex === 0;
      if (atStart && !opts.loop) return;
      const prevIdx = atStart ? images.length - 1 : currentIndex - 1;
      this.jumpTo(prevIdx);
    },

    setOptions(newOpts: Partial<ImageSequenceOptions>) {
      if (newOpts.images && newOpts.images.length === 0) {
        throw new Error('ImageSequenceOptions.images must contain at least one image URL');
      }
      opts = { ...opts, ...newOpts };
      if (newOpts.images) {
        images = opts.shuffle ? shuffleArray(newOpts.images) : [...newOpts.images];
        currentIndex = Math.min(currentIndex, images.length - 1);
        if (images.length > 0) {
          element.src = images[currentIndex];
        }
      }
    },

    async preloadAll(): Promise<void> {
      const promises = images.map((url) =>
        preloadImage(url).catch((err) => {
          opts.onError?.(url, err);
        })
      );
      await Promise.all(promises);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      paused = false;
      cancelSchedule?.();
      cancelSchedule = null;
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      opts.onDestroy?.();
    },
  };

  return controller;
}

/**
 * Create image sequence controller by selector.
 * Returns null if element not found or not an image.
 */
export function imageSequence(
  selector: string,
  options: ImageSequenceOptions
): ImageSequenceController | null {
  const el = document.querySelector<HTMLImageElement>(selector);
  if (!el || el.tagName !== 'IMG') return null;
  return createImageSequence(el, options);
}

/**
 * Create image sequences for all matching elements.
 * Each element cycles through the same image array.
 */
export function imageSequenceAll(
  selector: string,
  options: ImageSequenceOptions
): ImageSequenceController[] {
  const elements = document.querySelectorAll<HTMLImageElement>(selector);
  return Array.from(elements).map((el) => createImageSequence(el, options));
}

export { preloadImage, preloadImages, preloadAhead, isImageCached, clearImageCache, getCacheStats } from './preloader.js';
