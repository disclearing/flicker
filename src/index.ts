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
  TimingEngine,
  FilterOptions,
  TextMode,
} from './types.js';

// Constants
export { DEFAULT_FLICKER_OPTIONS } from './types.js';

// Validation
export {
  validateFlickerOptions,
  validateImageSequenceOptions,
  validateOrThrow,
  normalizeInterval,
  normalizeOpacity,
} from './validation.js';
export type { ValidationResult } from './validation.js';

// Engine (scheduler, visibility, reduced-motion)
export { schedule, scheduleRepeating, prefersReducedMotion, subscribeVisibility } from './engine.js';
export type { ScheduleOptions } from './engine.js';

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

// Effects (CSS filters, text modes)
export {
  buildFilterString,
  applyFilters,
  applyChromaticAberration,
  applyFullFilters,
  preparePerCharFlicker,
  runScrambleReveal,
  runGlyphSubstitution,
  runTypewriter,
} from './effects.js';
export type { TextEffectOptions } from './effects.js';

// Presets
export {
  neonSign,
  horrorGlitch,
  oldTV,
  warningAlarm,
  flickerPresets,
  getFlickerPreset,
  sequenceNeon,
  sequenceHorror,
  sequenceOldTV,
  sequenceWarning,
  sequencePresets,
  getSequencePreset,
  getCombinedPreset,
} from './presets.js';
export type {
  PresetFlickerOptions,
  PresetSequenceOptions,
  FlickerPresetName,
  SequencePresetName,
} from './presets.js';

// Plugins
export {
  registerTransition,
  unregisterTransition,
  getTransition,
  isCustomTransition,
  runTransition,
  registerEffect,
  unregisterEffect,
  getEffect,
  runEffects,
} from './plugins.js';
export type { CustomTransitionFn, FlickerEffectFn } from './plugins.js';

// Timeline
export { createTimeline } from './timeline.js';
export type { TimelineStep, TimelineOptions, TimelineController } from './timeline.js';

// Group orchestration
export { createGroup, registerScenePreset, getScenePreset, createGroupFromPreset } from './group.js';
export type { GroupMember, GroupOptions, GroupController, OrchestratedGroup, ScenePreset } from './group.js';

// Audio-reactive
export { createAudioReactiveFlicker, isAudioReactiveSupported } from './audio.js';
export type { AudioReactiveOptions } from './audio.js';

// Canvas / WebGL renderers
export {
  isCanvasSupported,
  createEffectCanvas,
  renderFrame,
  createCanvasRenderer,
} from './renderer-canvas.js';
export type {
  CanvasEffectType,
  CanvasEffectOptions,
  CanvasRendererController,
} from './renderer-canvas.js';
export { isWebGLSupported, createWebGLCanvas } from './renderer-webgl.js';

// Preloader config and eviction (preloadImage/preloadImages etc. are from image-sequence re-export)
export { configurePreloader, evictStale } from './preloader.js';
export type { PreloadOptions, PreloaderConfig } from './preloader.js';
