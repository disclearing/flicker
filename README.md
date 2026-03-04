# @disclearing/flicker

Utility for flickering text, images, and DOM elements with configurable timing, intensity, and advanced image manipulation. Includes a **unified text writer** (write/queue/add/remove), **text presets** (zalgo, terminal, neo, cosmic, horror), CSS filters, text effects (scramble, typewriter, decode), presets, plugins, timeline/keyframes, group orchestration, audio-reactive mode, canvas/WebGL renderers, and framework adapters.

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

// Text writer presets: zalgo, terminal, neo, cosmic, horror, encrypted, nier, default
const textOpts = getTextPreset('zalgo', { interval: 40 });
createTextWriter(el, textOpts).write('Hello world');
```

## Text writer

Unified writer API: `write()`, `writeAsync()`, `queue()`, `endless()`, `add()`, `remove()` with scramble, typewriter, decode, or glyph-sub effects. Respects `engine`, `respectReducedMotion`, and `autoPauseOnHidden` like other controllers.

```js
import { createTextWriter, getTextPreset } from '@disclearing/flicker';

const el = document.querySelector('.text-target');
const writer = createTextWriter(el, { mode: 'scramble', interval: 60, cursor: true });

writer.write('Hello');                              // animate in one string
await writer.writeAsync('Done');                     // Promise resolves when animation finishes
writer.queue(['Line 1', 'Line 2'], 500, true);       // queue phrases, optional loop
writer.endless(['A', 'B', 'C'], 300);               // same as queue(..., true)
writer.add(' more');                                // append and animate new part only
writer.remove(3);                                   // remove last 3 chars
writer.on('complete', () => console.log('done'));   // multiple listeners
writer.off('complete', handler);
writer.pause();
writer.resume();
writer.destroy();
```

- **Custom event**: When a write completes, the element dispatches `flicker-writer-finished` with `detail: { text, length }` so you can listen without callbacks.
- **Modes**: `'scramble'` (reveal from random glyphs), `'typewriter'` (character-by-character, optional human-like variance and punctuation pause), `'decode'` (each char resolves from random to final), `'glyph-sub'` (continuous substitution).
- **Options**: `glyphPool`, `interval`, `minInterval`/`maxInterval`, `humanLike`, `pauseOnSpaces`, `punctuationPauseMs`, `cursor: true | '|'` (typing cursor for typewriter/decode), `html: 'strip' | 'preserve'`, `letterize: 'in-place' | 'fragment'`, `onStep(index, char, isComplete)`, `onComplete`, plus engine and a11y options.
- **Events**: `writer.on('start' | 'step' | 'complete' | 'destroy' | 'visibilitychange', fn)` and `writer.off(event, fn)` for multiple listeners.
- **Helpers**: `decodeEntities()`, `letterizeToFragment()`, `setLetterizedContent()` for custom flows; `runDecode()` for one-shot decode effect.

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
import { useFlicker, useFlickerController, useImageSequence, useTimeline, useTextWriter } from '@disclearing/flicker/react';

function MyComponent() {
  const ref = useRef(null);
  useFlicker(ref, { interval: 100 });
  return <div ref={ref}>Flickering text</div>;
}

// Text writer: bind ref and get controller (write, queue, writeAsync, endless, etc.)
function WriterDemo() {
  const ref = useRef(null);
  const writerRef = useTextWriter(ref, { mode: 'typewriter', cursor: true });
  useEffect(() => {
    writerRef.current?.write('Hello world');
  }, []);
  return <div ref={ref} />;
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

**Expo / React Native** (optional):

```js
import { useExpoFlicker, useExpoImageSequence } from '@disclearing/flicker/expo';
```

```tsx
function GlitchImage() {
  const { currentImage, controller: seq } = useExpoImageSequence({
    images: ['https://example.com/1.png', 'https://example.com/2.png'],
    interval: 500,
    loop: true,
  });
  const { opacity, controller: flicker } = useExpoFlicker({ interval: 80, offOpacity: 0.15 });

  useEffect(() => {
    seq.start();
    flicker.start();
    return () => {
      seq.destroy();
      flicker.destroy();
    };
  }, [seq, flicker]);

  return <Image source={{ uri: currentImage ?? undefined }} style={{ opacity, width: 200, height: 200 }} />;
}
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
- **Text**: `preparePerCharFlicker(container)`, `runScrambleReveal(container, options)`, `runGlyphSubstitution(container, options)`, `runTypewriter(container, options)`, `runDecode(container, options)` (decode/decrypt: each char resolves from random glyphs). Options support `onStep(index, char, isComplete)` and `startFromIndex` for writer add(). Container gets `data-flicker-state="writing"` and class `flicker-writing` during animation; spans get `data-flicker-char-index`.
- **HTML/entities**: `decodeEntities(str)`, `letterizeToFragment(text)`, `setLetterizedContent(container, text)`. Use `html: 'strip' | 'preserve'` and `decodeEntitiesIn` in effect options.

## Controllers (summary)

- **FlickerController**: `start()`, `stop()`, `setOptions()`, `destroy()`, `isRunning`.
- **ImageSequenceController**: same plus `pause()`, `resume()`, `jumpTo()`, `next()`, `previous()`, `preloadAll()`, `isPaused`, `currentIndex`, `totalImages`, `currentImage`.
- **CombinedFlickerController**: both plus `state` (visible, imageIndex, imageUrl).

## License

MIT
