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

Use canvas for noise, scanline, or distortion overlays (e.g. on video):

```js
import { createCanvasRenderer, isCanvasSupported } from '@disclearing/flicker';

if (!isCanvasSupported()) return;
const renderer = createCanvasRenderer(videoEl, { type: 'scanline', scanlineSpacing: 4 });
renderer.start();
document.body.appendChild(renderer.canvas);
```

WebGPU when available:

```js
import { createWebGPURenderer, isWebGPUSupported } from '@disclearing/flicker';

if (isWebGPUSupported()) {
  const gpuRenderer = createWebGPURenderer(videoEl, {
    type: 'noise',
    noiseAmount: 0.12,
    scanlineOpacity: 0.1,
  });
  gpuRenderer.start();
  if (gpuRenderer.canvas) document.body.appendChild(gpuRenderer.canvas);
}
```

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
