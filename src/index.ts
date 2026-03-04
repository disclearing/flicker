/**
 * Flicker – utilities for flickering text, images, and DOM elements.
 * Includes advanced image sequence cycling with transitions.
 * @packageDocumentation
 */

// Types
export type {
  FlickerOptions,
  FlickerController,
  ImageSequenceOptions,
  ImageSequenceController,
  ImageTransition,
  CombinedFlickerOptions,
  CombinedFlickerController,
} from './types.js';

// Constants
export { DEFAULT_FLICKER_OPTIONS } from './types.js';

// Basic flicker
export {
  createFlicker,
  flickerElement,
  flickerAll,
  flickerSelector,
} from './flicker.js';

// Image sequence / cycling
export {
  createImageSequence,
  imageSequence,
  imageSequenceAll,
  preloadImage,
  preloadImages,
  preloadAhead,
  isImageCached,
  clearImageCache,
  getCacheStats,
} from './image-sequence.js';

// Combined flicker + image sequence
export {
  createCombinedFlicker,
  combinedFlicker,
  combinedFlickerAll,
} from './combined.js';
