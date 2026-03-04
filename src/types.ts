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
  /** Callback when flicker cycle runs (visible → hidden or vice versa). */
  onTick?: (visible: boolean) => void;
  /** Callback when flicker is stopped (by duration or .stop()). */
  onStop?: () => void;
}

/** Default options. */
export const DEFAULT_FLICKER_OPTIONS: Required<Omit<FlickerOptions, 'duration' | 'onTick' | 'onStop'>> & Pick<FlickerOptions, 'duration' | 'onTick' | 'onStop'> = {
  interval: 80,
  minInterval: 40,
  maxInterval: 200,
  randomInterval: false,
  mode: 'opacity',
  offOpacity: 0,
  duration: undefined,
  onTick: undefined,
  onStop: undefined,
};

/** Controller returned by createFlicker; use to start/stop and update options. */
export interface FlickerController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<FlickerOptions>): void;
  readonly isRunning: boolean;
}

/**
 * Transition types for image cycling.
 */
export type ImageTransition =
  | 'instant'      // Immediate swap
  | 'crossfade'    // Fade between images
  | 'slide-left'   // Slide from right to left
  | 'slide-right'  // Slide from left to right
  | 'slide-up'     // Slide from bottom to top
  | 'slide-down'   // Slide from top to bottom
  | 'zoom'         // Zoom in/out transition
  | 'flicker';     // Use flicker effect during transition

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
  /** Callback when image changes. Receives (currentIndex, totalImages, imageUrl). */
  onChange?: (index: number, total: number, url: string) => void;
  /** Callback when all images have been shown once (only fires if loop is false). */
  onComplete?: () => void;
  /** Callback when stopped. */
  onStop?: () => void;
  /** Callback when an image fails to load. Receives (url, error). */
  onError?: (url: string, error: Error) => void;
}

/** Default image sequence options. */
export const DEFAULT_IMAGE_SEQUENCE_OPTIONS: Required<Omit<ImageSequenceOptions, 'images' | 'duration' | 'onChange' | 'onComplete' | 'onStop' | 'onError'>> &
  Pick<ImageSequenceOptions, 'duration' | 'onChange' | 'onComplete' | 'onStop' | 'onError'> = {
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
  onChange: undefined,
  onComplete: undefined,
  onStop: undefined,
  onError: undefined,
};

/** Controller for image sequence cycling. */
export interface ImageSequenceController {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  /** Jump to a specific image index. */
  jumpTo(index: number): void;
  /** Go to next image. */
  next(): void;
  /** Go to previous image. */
  previous(): void;
  setOptions(options: Partial<ImageSequenceOptions>): void;
  /** Preload all images manually. Returns promise that resolves when done. */
  preloadAll(): Promise<void>;
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
  /** Flicker options for the visibility effect. */
  flicker: FlickerOptions;
  /** Image sequence options for cycling images. */
  sequence: ImageSequenceOptions;
}

/** Controller for combined flicker + image sequence. */
export interface CombinedFlickerController {
  // From FlickerController
  start(): void;
  stop(): void;
  /** Update combined options. */
  setOptions(options: Partial<CombinedFlickerOptions>): void;
  readonly isRunning: boolean;

  // From ImageSequenceController
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

  /** Get current combined state. */
  readonly state: {
    visible: boolean;
    imageIndex: number;
    imageUrl: string | null;
  };
}
