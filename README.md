# @disclearing/flicker

Utility for flickering text, images, and DOM elements with configurable timing, intensity, and advanced image manipulation. Includes CSS filters, text effects, presets, plugins, timeline/keyframes, group orchestration, audio-reactive mode, canvas/WebGL renderers, and framework adapters.

## Install

```bash
npm install @disclearing/flicker
```

## Basic Usage

### Flicker a single element

```js
import { createFlicker } from '@disclearing/flicker';

const el = document.querySelector('.my-text');
const controller = createFlicker(el, { interval: 100 });

controller.start();
// later: controller.stop(); controller.destroy();
```

### By selector (SSR-safe)

```js
import { flickerElement, flickerSelector } from '@disclearing/flicker';

const ctrl = flickerElement('#logo');
if (ctrl) ctrl.start();

const controllers = flickerSelector('.flicker-me');
controllers.forEach((c) => c.start());
```

## Options: Engine, reduced motion, visibility

- **`engine`**: `'timeout'` (default) or `'raf'` for requestAnimationFrame-based timing.
- **`respectReducedMotion`**: When `true` (default), honors `prefers-reduced-motion` and disables or softens flicker.
- **`autoPauseOnHidden`**: When `true` (default), pauses when the tab is hidden and resumes when visible.
- **Richer events**: `onStart`, `onPause`, `onResume`, `onDestroy`, `onVisibilityChange`; image sequences also support `onTransitionStart`, `onTransitionEnd`, `onLoop`.

Always call **`destroy()`** when discarding a controller to clear timers and listeners.

## Presets

Use built-in presets for common looks:

```js
import { getFlickerPreset, getSequencePreset, getCombinedPreset } from '@disclearing/flicker';

// Flicker presets: neonSign, horrorGlitch, oldTV, warningAlarm
const opts = getFlickerPreset('horrorGlitch', { interval: 40 });
createFlicker(el, opts).start();

// Sequence presets: neon, horror, oldTV, warning
const seqOpts = getSequencePreset('horror', { images: ['/a.jpg', '/b.jpg'] });
createImageSequence(img, seqOpts).start();

// Combined
const combined = getCombinedPreset('horrorGlitch', 'horror', { sequence: { images: ['/1.jpg', '/2.jpg'] } });
createCombinedFlicker(img, combined).start();
```

## Plugins

Register custom transitions and effects:

```js
import { registerTransition, registerEffect, createFlicker } from '@disclearing/flicker';

registerTransition('my-fade', async (element, newSrc, duration) => {
  element.style.opacity = '0';
  await new Promise((r) => setTimeout(r, duration / 2));
  element.src = newSrc;
  element.style.opacity = '1';
});

registerEffect('my-glow', (el, visible) => {
  el.style.boxShadow = visible ? '0 0 20px rgba(255,0,0,0.5)' : 'none';
});

createFlicker(el, {}).start(); // registered effects run each tick
createImageSequence(img, { images: ['/a.jpg', '/b.jpg'], transition: 'my-fade' }).start();
```

## Timeline and group orchestration

**Timeline**: run steps in order (flicker for N ms, pause, custom callback, etc.):

```js
import { createTimeline } from '@disclearing/flicker';

const timeline = createTimeline([
  { type: 'flicker', element: titleEl, options: { interval: 50 }, duration: 300 },
  { type: 'pause', duration: 500 },
  { type: 'callback', fn: () => console.log('Done step 2') },
], { loop: false, onComplete: () => console.log('Timeline done') });
timeline.start();
```

**Group**: start multiple controllers with a shared clock and optional phase offsets:

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

## Audio-reactive flicker

Drive interval and intensity from microphone or audio element:

```js
import { createAudioReactiveFlicker, isAudioReactiveSupported } from '@disclearing/flicker';

if (!isAudioReactiveSupported()) return;
const audioEl = document.querySelector('audio');
const ctrl = createAudioReactiveFlicker(domEl, { source: audioEl });
ctrl.start();
```

## Canvas / WebGL / WebGPU renderers

Use canvas for noise, scanline, or distortion effects (with fallback when unsupported):

```js
import { createCanvasRenderer, isCanvasSupported } from '@disclearing/flicker';

if (!isCanvasSupported()) return;
const renderer = createCanvasRenderer(videoEl, { type: 'scanline', scanlineSpacing: 4 });
renderer.start();
document.body.appendChild(renderer.canvas);
```

Use WebGPU when available (with graceful no-op fallback if unsupported):

```js
import { createWebGPURenderer, isWebGPUSupported } from '@disclearing/flicker';

if (isWebGPUSupported()) {
  const gpuRenderer = createWebGPURenderer(videoEl, {
    type: 'noise',
    noiseAmount: 0.12,
    scanlineOpacity: 0.1,
  });
  gpuRenderer.start();
  if (gpuRenderer.canvas) {
    document.body.appendChild(gpuRenderer.canvas);
  }
}
```

## Framework adapters

**React** (install `react` when using):

```js
import { useFlicker, useFlickerController, useImageSequence, useTimeline } from '@disclearing/flicker/react';

function MyComponent() {
  const ref = useRef(null);
  useFlicker(ref, { interval: 100 });
  return <div ref={ref}>Flickering text</div>;
}
```

**Vue 3** (optional):

```js
import { useFlicker, flickerDirective } from '@disclearing/flicker/vue';

// Composition: call start() in onMounted
const { start, stop } = useFlicker(elementRef, { interval: 100 });

// Directive
app.directive('flicker', { mounted: flickerDirective, unmounted: unmountFlickerDirective });
```

**Svelte** (optional):

```js
import { flicker, imageSequence } from '@disclearing/flicker/svelte';
```

```svelte
<div use:flicker={{ interval: 100 }}>Flickering</div>
<img use:imageSequence={{ images: ['/a.jpg', '/b.jpg'], interval: 500 }} alt="" />
```

## Validation

Validate options before use:

```js
import { validateFlickerOptions, validateOrThrow } from '@disclearing/flicker';

const result = validateFlickerOptions({ interval: -1 });
if (!result.valid) console.error(result.errors);

validateOrThrow(userOptions, validateFlickerOptions, 'Flicker');
```

## Image sequences (summary)

- **Transitions**: `instant`, `crossfade`, `slide-left/right/up/down`, `zoom`, `flicker`, or custom via `registerTransition`.
- **Options**: `interval`, `randomInterval`, `minInterval`/`maxInterval`, `transition`, `transitionDuration`, `loop`, `shuffle`, `startIndex`, `direction`, `preload`, `preloadAhead`, `duration`, and callbacks including `onStart`, `onPause`, `onResume`, `onTransitionStart`, `onTransitionEnd`, `onLoop`, `onDestroy`, `onVisibilityChange`, `onError`.

## Preloader

- **Retry/backoff**: `preloadImage(url, { retries: 2, backoffMs: 500 })`.
- **Cache limits**: `configurePreloader({ maxCacheSize: 100, evictionStrategy: 'leastRecentlyUsed' })`.
- **Eviction**: `evictStale(maxAgeMs)`.

## Effects and text modes

- **CSS filters**: `applyFilters(el, { blur, contrast, hueRotate, saturate, chromaticAberration, rgbSplit })`; use `filters` in flicker options for the "off" phase.
- **Text**: `preparePerCharFlicker(container)`, `runScrambleReveal(container, options)`, `runGlyphSubstitution(container, options)`, `runTypewriter(container, options)`.

## Controllers (summary)

- **FlickerController**: `start()`, `stop()`, `setOptions()`, `destroy()`, `isRunning`.
- **ImageSequenceController**: same plus `pause()`, `resume()`, `jumpTo()`, `next()`, `previous()`, `preloadAll()`, `isPaused`, `currentIndex`, `totalImages`, `currentImage`.
- **CombinedFlickerController**: both plus `state` (visible, imageIndex, imageUrl).

## License

MIT
