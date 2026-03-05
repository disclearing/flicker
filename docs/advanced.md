# Advanced

## Timeline

Run steps in order: flicker for N ms, pause, custom callback, etc.

```js
import { createTimeline } from '@disclearing/flicker';

const timeline = createTimeline(
  [
    { type: 'flicker', element: titleEl, options: { interval: 50 }, duration: 300 },
    { type: 'pause', duration: 500 },
    { type: 'callback', fn: () => console.log('Step done') },
  ],
  { loop: false, onComplete: () => console.log('Timeline done') }
);
timeline.start();
```

## Group

Start multiple controllers with a shared clock and optional phase offsets:

```js
import { createGroup, createFlicker } from '@disclearing/flicker';

const c1 = createFlicker(el1, { interval: 100 });
const c2 = createFlicker(el2, { interval: 100 });
const group = createGroup([
  { controller: c1 },
  { controller: c2, phaseOffsetMs: 50 },
]);
group.start();
```

You can also use `registerScenePreset` and `createGroupFromPreset` for predefined group setups.

## Audio-reactive flicker

Drive interval and intensity from microphone or an audio element:

```js
import { createAudioReactiveFlicker, isAudioReactiveSupported } from '@disclearing/flicker';

if (!isAudioReactiveSupported()) return;
const audioEl = document.querySelector('audio');
const ctrl = createAudioReactiveFlicker(domEl, { source: audioEl });
ctrl.start();
```

## Canvas / WebGL / WebGPU renderers

All three renderers support the same effect types: `noise`, `scanline`, `distortion`, and `none`. They draw a source image or video to a canvas with optional effects.

### Canvas 2D

Use when WebGL/WebGPU are unavailable or you want a simple fallback. The canvas renderer resizes with the source, pauses when the tab is hidden (optional), and supports performance options:

```js
import { createCanvasRenderer, isCanvasSupported } from '@disclearing/flicker';

if (!isCanvasSupported()) return;
const renderer = createCanvasRenderer(videoEl, {
  type: 'scanline',
  scanlineSpacing: 4,
  scanlineOpacity: 0.15,
  autoPauseOnHidden: true,  // default: pause when tab hidden
  scale: 0.5,               // optional: render at half size for CPU savings
  throttleFps: 30,         // optional: cap FPS (omit for full RAF)
});
renderer.start();
document.body.appendChild(renderer.canvas);
```

- **Options**: `type`, `noiseAmount`, `scanlineSpacing`, `scanlineOpacity`, `distortionAmount`, `scale` (0.1–1), `throttleFps`, `autoPauseOnHidden`.
- **One-shot**: `createEffectCanvas(source, options)` or `renderFrame(source, options)` for a single frame.

### WebGL

WebGL renderer for pass-through or effects when WebGPU is not available. Single-frame only via `createWebGLCanvas`:

```js
import { createWebGLCanvas, isWebGLSupported } from '@disclearing/flicker';

if (isWebGLSupported()) {
  const canvas = createWebGLCanvas(videoEl, { type: 'noise', noiseAmount: 0.1 });
  if (canvas) document.body.appendChild(canvas);
}
```

### WebGPU

Best performance when available. Supports continuous loop, auto-resize when source dimensions change, and device-lost handling:

```js
import { createWebGPURenderer, createWebGPUCanvas, isWebGPUSupported } from '@disclearing/flicker';

if (isWebGPUSupported()) {
  const gpuRenderer = createWebGPURenderer(videoEl, {
    type: 'noise',
    noiseAmount: 0.12,
    scanlineOpacity: 0.1,
    autoResize: true,       // default: resize canvas/texture when video size changes
    onDeviceLost: (info) => console.warn('WebGPU device lost', info),
  });
  gpuRenderer.start();
  if (gpuRenderer.canvas) document.body.appendChild(gpuRenderer.canvas);

  // Or use the async helper: wait for init, then get canvas
  const canvas = await createWebGPUCanvas(videoEl, { type: 'scanline' });
  if (canvas) document.body.appendChild(canvas);
}
```

- **Controller**: `start()`, `stop()`, `setOptions()`, `destroy()`, `ready(): Promise<boolean>` (resolve when init complete), `canvas`, `isInitialized`.
- **Options**: Same as canvas plus `powerPreference`, `autoResize`, `onDeviceLost`.

## Validation

Validate options before use (e.g. from user input):

```js
import { validateFlickerOptions, validateImageSequenceOptions, validateOrThrow } from '@disclearing/flicker';

const result = validateFlickerOptions({ interval: -1 });
if (!result.valid) console.error(result.errors);

validateOrThrow(userOptions, validateFlickerOptions, 'Flicker');
```

## Image sequence details

- **Transitions**: `instant`, `crossfade`, `slide-left` / `slide-right` / `slide-up` / `slide-down`, `zoom`, `flicker`, or custom via `registerTransition`.
- **Options**: `interval`, `randomInterval`, `minInterval` / `maxInterval`, `transition`, `transitionDuration`, `loop`, `shuffle`, `startIndex`, `direction`, `preload`, `preloadAhead`, `duration`, and callbacks (`onStart`, `onPause`, `onResume`, `onTransitionStart`, `onTransitionEnd`, `onLoop`, `onDestroy`, `onVisibilityChange`, `onError`).
- **Controller**: `jumpTo(index)`, `next()`, `previous()`, `preloadAll()`, `currentIndex`, `totalImages`, `currentImage`.

## Preloader

- `preloadImage(url, { retries, backoffMs })` — retry/backoff.
- `configurePreloader({ maxCacheSize, evictionStrategy })` — cache limits.
- `evictStale(maxAgeMs)` — evict old entries.

## Controllers summary

| Controller | Key methods / state |
|------------|---------------------|
| **FlickerController** | `start`, `stop`, `setOptions`, `destroy`, `isRunning` |
| **ImageSequenceController** | Same plus `pause`, `resume`, `jumpTo`, `next`, `previous`, `preloadAll`, `isPaused`, `currentIndex`, `totalImages`, `currentImage` |
| **CombinedFlickerController** | Flicker + sequence plus `state: { visible, imageIndex, imageUrl }` |
| **TextWriterController** | `write`, `writeAsync`, `queue`, `endless`, `add`, `remove`, `on`, `off`, `start`, `stop`, `pause`, `resume`, `destroy`, `isRunning`, `isPaused`, `currentLength` |
