/**
 * Timing engine: setTimeout (default) or requestAnimationFrame.
 */
export type TimingEngine = 'timeout' | 'raf';

/**
 * CSS filter options for glitch/effect pipelines.
 */
export interface FilterOptions {
  /** Blur radius in px. 0 = off. */
  blur?: number;
  /** Contrast multiplier. 1 = normal. */
  contrast?: number;
  /** Hue rotation in degrees. */
  hueRotate?: number;
  /** Saturation multiplier. 1 = normal. */
  saturate?: number;
  /** Chromatic aberration offset in px (red/cyan shift). */
  chromaticAberration?: number;
  /** RGB split offsets: [rX, rY, gX, gY, bX, bY] in px. */
  rgbSplit?: [number, number, number, number, number, number];
}

/**
 * Text-specific effect modes.
 */
export type TextMode =
  | 'none'           // no text effect
  | 'per-char'       // flicker per character
  | 'scramble'       // scramble/reveal
  | 'glyph-sub'      // random glyph substitution
  | 'typewriter'     // typewriter + flicker
  | 'decode';        // decode/decrypt: resolve from random glyphs to final char

/** Writer animation mode for createTextWriter. */
export type WriterMode = 'scramble' | 'typewriter' | 'decode' | 'glyph-sub';

/** How to handle HTML in text: preserve structure or strip to plain text. */
export type HtmlMode = 'preserve' | 'strip';

/** Letterization: mutate container in-place or return a fragment. */
export type LetterizeMode = 'in-place' | 'fragment';

/**
 * Options for flicker behavior.
 */
export interface FlickerOptions {
  /** Interval in ms between visibility toggles. Default: 80 */
  interval?: number;
  /** Minimum interval when using random timing (ms). Default: 40 */
  minInterval?: number;
  /** Maximum interval when using random timing (ms). Default: 200 */
  maxInterval?: number;
  /** Use random interval within [minInterval, maxInterval] for organic flicker. Default: false */
  randomInterval?: boolean;
  /** Property to toggle: 'opacity' | 'visibility' | 'both'. Default: 'opacity' */
  mode?: 'opacity' | 'visibility' | 'both';
  /** Opacity when "off" (0–1). Default: 0 */
  offOpacity?: number;
  /** Optional max duration in ms; flicker stops after this. Omit for infinite. */
  duration?: number;
  /** Timing engine. Default: 'timeout' */
  engine?: TimingEngine;
  /** Honor prefers-reduced-motion (disable or soften flicker). Default: true */
  respectReducedMotion?: boolean;
  /** Auto-pause when tab is hidden. Default: true */
  autoPauseOnHidden?: boolean;
  /** Optional CSS filter overrides during "off" phase. */
  filters?: FilterOptions;
  /** Callback when flicker starts. */
  onStart?: () => void;
  /** Callback when flicker cycle runs (visible → hidden or vice versa). */
  onTick?: (visible: boolean) => void;
  /** Callback when flicker is stopped (by duration or .stop()). */
  onStop?: () => void;
  /** Callback when paused. */
  onPause?: () => void;
  /** Callback when resumed. */
  onResume?: () => void;
  /** Callback when controller is destroyed. */
  onDestroy?: () => void;
  /** Callback when tab visibility changes. */
  onVisibilityChange?: (visible: boolean) => void;
}

/** Default options. */
export const DEFAULT_FLICKER_OPTIONS: Required<Omit<FlickerOptions, 'duration' | 'filters' | 'onStart' | 'onTick' | 'onStop' | 'onPause' | 'onResume' | 'onDestroy' | 'onVisibilityChange'>> & Pick<FlickerOptions, 'duration' | 'filters' | 'onStart' | 'onTick' | 'onStop' | 'onPause' | 'onResume' | 'onDestroy' | 'onVisibilityChange'> = {
  interval: 80,
  minInterval: 40,
  maxInterval: 200,
  randomInterval: false,
  mode: 'opacity',
  offOpacity: 0,
  duration: undefined,
  engine: 'timeout',
  respectReducedMotion: true,
  autoPauseOnHidden: true,
  filters: undefined,
  onStart: undefined,
  onTick: undefined,
  onStop: undefined,
  onPause: undefined,
  onResume: undefined,
  onDestroy: undefined,
  onVisibilityChange: undefined,
};

/** Controller returned by createFlicker; use to start/stop and update options. */
export interface FlickerController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<FlickerOptions>): void;
  /** Clean up timers and listeners. Call when discarding the controller. */
  destroy(): void;
  readonly isRunning: boolean;
}

/**
 * Transition types for image cycling.
 */
export type ImageTransition =
  | 'instant'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom'
  | 'flicker';

/**
 * Options for image sequence/cycling behavior.
 */
export interface ImageSequenceOptions {
  /** Array of image URLs to cycle through. Required. */
  images: string[];
  /** Interval in ms between image changes. Default: 1000 */
  interval?: number;
  /** Minimum interval when using random timing (ms). Default: 500 */
  minInterval?: number;
  /** Maximum interval when using random timing (ms). Default: 2000 */
  maxInterval?: number;
  /** Use random interval for organic feel. Default: false */
  randomInterval?: boolean;
  /** Transition type between images. Default: 'instant' */
  transition?: ImageTransition;
  /** Duration of transition effect in ms. Default: 300 */
  transitionDuration?: number;
  /** Whether to loop the sequence. Default: true */
  loop?: boolean;
  /** Whether to shuffle the image order. Default: false */
  shuffle?: boolean;
  /** Start from a specific index. Default: 0 */
  startIndex?: number;
  /** Direction: 1 for forward, -1 for backward. Default: 1 */
  direction?: 1 | -1;
  /** Preload images for smooth transitions. Default: true */
  preload?: boolean;
  /** Number of images to preload ahead. Default: 2 */
  preloadAhead?: number;
  /** Optional max duration in ms; cycling stops after this. */
  duration?: number;
  /** Timing engine. Default: 'timeout' */
  engine?: TimingEngine;
  /** Honor prefers-reduced-motion. Default: true */
  respectReducedMotion?: boolean;
  /** Auto-pause when tab hidden. Default: true */
  autoPauseOnHidden?: boolean;
  /** Optional filter overrides during transitions. */
  filters?: FilterOptions;
  /** Callback when image changes. Receives (currentIndex, totalImages, imageUrl). */
  onChange?: (index: number, total: number, url: string) => void;
  /** Callback when all images have been shown once (only fires if loop is false). */
  onComplete?: () => void;
  /** Callback when stopped. */
  onStop?: () => void;
  /** Callback when sequence starts. */
  onStart?: () => void;
  /** Callback when paused. */
  onPause?: () => void;
  /** Callback when resumed. */
  onResume?: () => void;
  /** Callback when transition begins. */
  onTransitionStart?: (fromIndex: number, toIndex: number) => void;
  /** Callback when transition ends. */
  onTransitionEnd?: (index: number) => void;
  /** Callback when loop completes a full cycle. */
  onLoop?: () => void;
  /** Callback when controller is destroyed. */
  onDestroy?: () => void;
  /** Callback when tab visibility changes. */
  onVisibilityChange?: (visible: boolean) => void;
  /** Callback when an image fails to load. Receives (url, error). */
  onError?: (url: string, error: Error) => void;
}

/** Default image sequence options. */
export const DEFAULT_IMAGE_SEQUENCE_OPTIONS: Required<Omit<ImageSequenceOptions, 'images' | 'duration' | 'filters' | 'onChange' | 'onComplete' | 'onStop' | 'onStart' | 'onPause' | 'onResume' | 'onTransitionStart' | 'onTransitionEnd' | 'onLoop' | 'onDestroy' | 'onVisibilityChange' | 'onError'>> &
  Pick<ImageSequenceOptions, 'duration' | 'filters' | 'onChange' | 'onComplete' | 'onStop' | 'onStart' | 'onPause' | 'onResume' | 'onTransitionStart' | 'onTransitionEnd' | 'onLoop' | 'onDestroy' | 'onVisibilityChange' | 'onError'> = {
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
  duration: undefined,
  engine: 'timeout',
  respectReducedMotion: true,
  autoPauseOnHidden: true,
  filters: undefined,
  onChange: undefined,
  onComplete: undefined,
  onStop: undefined,
  onStart: undefined,
  onPause: undefined,
  onResume: undefined,
  onTransitionStart: undefined,
  onTransitionEnd: undefined,
  onLoop: undefined,
  onDestroy: undefined,
  onVisibilityChange: undefined,
  onError: undefined,
};

/** Controller for image sequence cycling. */
export interface ImageSequenceController {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  jumpTo(index: number): void;
  next(): void;
  previous(): void;
  setOptions(options: Partial<ImageSequenceOptions>): void;
  preloadAll(): Promise<void>;
  destroy(): void;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly currentIndex: number;
  readonly totalImages: number;
  readonly currentImage: string | null;
}

/**
 * Options for combined flicker + image sequence effects.
 */
export interface CombinedFlickerOptions {
  flicker: FlickerOptions;
  sequence: ImageSequenceOptions;
}

/** Controller for combined flicker + image sequence. */
export interface CombinedFlickerController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<CombinedFlickerOptions>): void;
  destroy(): void;
  readonly isRunning: boolean;
  pause(): void;
  resume(): void;
  jumpTo(index: number): void;
  next(): void;
  previous(): void;
  preloadAll(): Promise<void>;
  readonly isPaused: boolean;
  readonly currentIndex: number;
  readonly totalImages: number;
  readonly currentImage: string | null;
  readonly state: {
    visible: boolean;
    imageIndex: number;
    imageUrl: string | null;
  };
}

/**
 * Options for the unified text writer (createTextWriter).
 */
export interface TextWriterOptions {
  /** Animation mode. Default: 'scramble' */
  mode?: WriterMode;
  /** Character pool for scramble/decode/glyph-sub. */
  glyphPool?: string;
  /** Interval per character (ms). Default: 80 */
  interval?: number;
  /** Min/max interval for human-like variance. */
  minInterval?: number;
  maxInterval?: number;
  /** Add per-character timing variance. Default: false */
  humanLike?: boolean;
  /** Pause after spaces (ms). Only for typewriter. */
  pauseOnSpaces?: number;
  /** Pause after punctuation (ms). Only for typewriter. */
  punctuationPauseMs?: number;
  /** How to handle HTML in written text. Default: 'strip' */
  html?: HtmlMode;
  /** Letterization: 'in-place' mutates DOM, 'fragment' returns a fragment. Default: 'in-place' */
  letterize?: LetterizeMode;
  /** Timing engine. Default: 'timeout' */
  engine?: TimingEngine;
  /** Honor prefers-reduced-motion. Default: true */
  respectReducedMotion?: boolean;
  /** Auto-pause when tab hidden. Default: true */
  autoPauseOnHidden?: boolean;
  /** Decode duration per char for decode mode (ms). Default: 60 */
  decodeDuration?: number;
  /** Callback on each character step: (index, char, isComplete). */
  onStep?: (index: number, char: string, isComplete: boolean) => void;
  /** Callback when current write finishes. */
  onComplete?: () => void;
  /** Callback when writer starts. */
  onStart?: () => void;
  /** Callback when writer is destroyed. */
  onDestroy?: () => void;
  /** Callback when tab visibility changes. */
  onVisibilityChange?: (visible: boolean) => void;
  /** Show a typing cursor during typewriter/decode. true = '|', or pass character, or { char, blink }. */
  cursor?: boolean | string | { char?: string; blink?: boolean };
  /** Optional seed for deterministic animations (same seed = same pattern). */
  seed?: number;
}

/** Writer event names for on/off. */
export type TextWriterEventName = 'start' | 'step' | 'complete' | 'destroy' | 'visibilitychange';

/** Controller for the unified text writer. */
export interface TextWriterController {
  /** Write a single string (replaces content, then animates). */
  write(text: string): void;
  /** Write and return a Promise that resolves when the animation finishes. */
  writeAsync(text: string): Promise<void>;
  /** Queue multiple phrases; plays in order. Optional interval between phrases, loop. */
  queue(phrases: string[], intervalBetween?: number, loop?: boolean): void;
  /** Run phrases in an endless loop (same as queue(phrases, intervalBetween, true)). */
  endless(phrases: string[], intervalBetween?: number): void;
  /** Append text to current content (animates the new part). */
  add(text: string): void;
  /** Remove n characters from the end. */
  remove(n: number): void;
  /** Add listener for event: 'start' | 'step' | 'complete' | 'destroy' | 'visibilitychange'. */
  on(event: TextWriterEventName, fn: (...args: unknown[]) => void): void;
  /** Remove listener. */
  off(event: TextWriterEventName, fn: (...args: unknown[]) => void): void;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  /** Current displayed text length (for add/remove). */
  readonly currentLength: number;
}
