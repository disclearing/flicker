import type {
  ImageSequenceOptions,
  ImageSequenceController,
  ImageTransition,
} from './types.js';
import { preloadImage, isImageCached } from './preloader.js';

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
 * Apply a transition effect between two images.
 */
function applyTransition(
  imgElement: HTMLImageElement,
  newSrc: string,
  transition: ImageTransition,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const parent = imgElement.parentElement;
    if (!parent) {
      imgElement.src = newSrc;
      resolve();
      return;
    }

    switch (transition) {
      case 'instant':
        imgElement.src = newSrc;
        resolve();
        break;

      case 'crossfade': {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;display:inline-block;';
        const newImg = document.createElement('img');
        newImg.src = newSrc;
        newImg.style.cssText =
          'position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity ' +
          duration +
          'ms;';
        newImg.style.objectFit = imgElement.style.objectFit || 'cover';

        if (imgElement.parentElement !== wrapper) {
          parent.insertBefore(wrapper, imgElement);
          wrapper.appendChild(imgElement);
        }
        wrapper.appendChild(newImg);

        // Trigger reflow
        void newImg.offsetWidth;
        newImg.style.opacity = '1';

        setTimeout(() => {
          imgElement.src = newSrc;
          imgElement.style.opacity = '1';
          newImg.remove();
          if (wrapper.parentElement) {
            wrapper.parentElement.insertBefore(imgElement, wrapper);
            wrapper.remove();
          }
          resolve();
        }, duration);
        break;
      }

      case 'slide-left':
      case 'slide-right':
      case 'slide-up':
      case 'slide-down': {
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
          'position:relative;display:inline-block;overflow:hidden;';
        const newImg = document.createElement('img');
        newImg.src = newSrc;

        const transforms: Record<string, string> = {
          'slide-left': 'translateX(100%)',
          'slide-right': 'translateX(-100%)',
          'slide-up': 'translateY(100%)',
          'slide-down': 'translateY(-100%)',
        };
        const ends: Record<string, string> = {
          'slide-left': 'translateX(0)',
          'slide-right': 'translateX(0)',
          'slide-up': 'translateY(0)',
          'slide-down': 'translateY(0)',
        };

        newImg.style.cssText =
          `position:absolute;top:0;left:0;width:100%;height:100%;transform:${transforms[transition]};transition:transform ${duration}ms ease-out;`;
        newImg.style.objectFit = imgElement.style.objectFit || 'cover';

        parent.insertBefore(wrapper, imgElement);
        wrapper.appendChild(imgElement);
        wrapper.appendChild(newImg);

        void newImg.offsetWidth;
        newImg.style.transform = ends[transition];

        setTimeout(() => {
          imgElement.src = newSrc;
          imgElement.style.transform = '';
          newImg.remove();
          if (wrapper.parentElement) {
            wrapper.parentElement.insertBefore(imgElement, wrapper);
            wrapper.remove();
          }
          resolve();
        }, duration);
        break;
      }

      case 'zoom': {
        imgElement.style.transition = `transform ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`;
        imgElement.style.transform = 'scale(0.8)';
        imgElement.style.opacity = '0.5';

        setTimeout(() => {
          imgElement.src = newSrc;
          void imgElement.offsetWidth;
          imgElement.style.transform = 'scale(1)';
          imgElement.style.opacity = '1';

          setTimeout(() => {
            imgElement.style.transition = '';
            resolve();
          }, duration);
        }, duration / 2);
        break;
      }

      case 'flicker': {
        const flickerCount = Math.floor(duration / 50);
        let count = 0;
        const flick = () => {
          imgElement.style.opacity = imgElement.style.opacity === '0' ? '1' : '0';
          count++;
          if (count >= flickerCount) {
            imgElement.src = newSrc;
            imgElement.style.opacity = '1';
            resolve();
          } else {
            setTimeout(flick, 50);
          }
        };
        flick();
        break;
      }

      default:
        imgElement.src = newSrc;
        resolve();
    }
  });
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startTime = 0;
  let runToken = 0;

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
    if (!running || paused || !element.isConnected) return;
    const currentRun = runToken;

    const direction = opts.direction ?? 1;
    let nextIndex = currentIndex + direction;

    if (nextIndex >= images.length) {
      if (opts.loop) {
        nextIndex = 0;
      } else {
        opts.onComplete?.();
        running = false;
        opts.onStop?.();
        return;
      }
    } else if (nextIndex < 0) {
      if (opts.loop) {
        nextIndex = images.length - 1;
      } else {
        opts.onComplete?.();
        running = false;
        opts.onStop?.();
        return;
      }
    }

    const nextUrl = images[nextIndex];

    // Ensure image is loaded before transition
    try {
      await preloadImage(nextUrl);
    } catch (err) {
      opts.onError?.(nextUrl, err as Error);
    }
    if (!running || paused || !element.isConnected || currentRun !== runToken) return;

    // Apply transition
    await applyTransition(
      element,
      nextUrl,
      opts.transition ?? 'instant',
      opts.transitionDuration ?? 300
    );
    if (!running || paused || !element.isConnected || currentRun !== runToken) return;

    currentIndex = nextIndex;
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
    timer = setTimeout(() => {
      void showNext();
    }, nextInterval);
  };

  const controller: ImageSequenceController = {
    get isRunning() {
      return running;
    },
    get isPaused() {
      return paused;
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
      void doPreload();
      const interval = getNextInterval(opts);
      timer = setTimeout(() => {
        void showNext();
      }, interval);
    },

    stop() {
      running = false;
      paused = false;
      runToken++;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      opts.onStop?.();
    },

    pause() {
      if (!running || paused) return;
      paused = true;
      runToken++;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      runToken++;
      const interval = getNextInterval(opts);
      timer = setTimeout(() => {
        void showNext();
      }, interval);
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
