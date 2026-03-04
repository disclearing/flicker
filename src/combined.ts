import type {
  FlickerOptions,
  ImageSequenceOptions,
  CombinedFlickerOptions,
  CombinedFlickerController,
} from './types.js';
import { createFlicker } from './flicker.js';
import { createImageSequence } from './image-sequence.js';

/**
 * Create a combined controller that simultaneously flickers and cycles through images.
 * Perfect for glitch effects on changing images.
 */
export function createCombinedFlicker(
  element: HTMLImageElement,
  options: CombinedFlickerOptions
): CombinedFlickerController {
  let visible = true;
  const originalFlickerOnTick = options.flicker.onTick;
  const flickerController = createFlicker(element, {
    ...options.flicker,
    onTick: (isVisible) => {
      visible = isVisible;
      originalFlickerOnTick?.(isVisible);
    },
  });
  const sequenceController = createImageSequence(element, options.sequence);

  let running = false;
  let paused = false;

  // Override the onChange to restart flicker for transition effects
  const originalOnChange = options.sequence.onChange;
  const wrappedOnChange: typeof originalOnChange = (index, total, url) => {
    // Brief flicker burst on image change
    if (running && !paused) {
      flickerController.stop();
      flickerController.start();
    }
    originalOnChange?.(index, total, url);
  };

  sequenceController.setOptions({ onChange: wrappedOnChange });

  const controller: CombinedFlickerController = {
    // FlickerController interface
    start() {
      if (running) return;
      running = true;
      paused = false;
      flickerController.start();
      sequenceController.start();
    },

    stop() {
      running = false;
      paused = false;
      flickerController.stop();
      sequenceController.stop();
      visible = true;
    },

    setOptions(newOpts: Partial<CombinedFlickerOptions>) {
      if (newOpts.flicker) {
        const nextOnTick = newOpts.flicker.onTick;
        flickerController.setOptions({
          ...newOpts.flicker,
          onTick: (isVisible) => {
            visible = isVisible;
            nextOnTick?.(isVisible);
          },
        });
      }
      if (newOpts.sequence) {
        sequenceController.setOptions(newOpts.sequence);
      }
    },

    get isRunning() {
      return running && flickerController.isRunning && sequenceController.isRunning;
    },

    // ImageSequenceController interface
    pause() {
      if (!running || paused) return;
      paused = true;
      flickerController.stop();
      sequenceController.pause();
      visible = true;
    },

    resume() {
      if (!running || !paused) return;
      paused = false;
      flickerController.start();
      sequenceController.resume();
    },

    jumpTo(index: number) {
      sequenceController.jumpTo(index);
    },

    next() {
      sequenceController.next();
    },

    previous() {
      sequenceController.previous();
    },

    preloadAll(): Promise<void> {
      return sequenceController.preloadAll();
    },

    get isPaused() {
      return paused;
    },

    get currentIndex() {
      return sequenceController.currentIndex;
    },

    get totalImages() {
      return sequenceController.totalImages;
    },

    get currentImage() {
      return sequenceController.currentImage;
    },

    get state() {
      return {
        visible,
        imageIndex: sequenceController.currentIndex,
        imageUrl: sequenceController.currentImage,
      };
    },
  };

  return controller;
}

/**
 * Combined flicker by selector.
 */
export function combinedFlicker(
  selector: string,
  options: CombinedFlickerOptions
): CombinedFlickerController | null {
  const el = document.querySelector<HTMLImageElement>(selector);
  if (!el || el.tagName !== 'IMG') return null;
  return createCombinedFlicker(el, options);
}

/**
 * Combined flicker for all matching image elements.
 */
export function combinedFlickerAll(
  selector: string,
  options: CombinedFlickerOptions
): CombinedFlickerController[] {
  const elements = document.querySelectorAll<HTMLImageElement>(selector);
  return Array.from(elements).map((el) => createCombinedFlicker(el, options));
}
