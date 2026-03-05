# Migration from glitched-writer

If you currently use **glitched-writer** for glitch/typewriter text, this guide maps its API and concepts to **@disclearing/flicker** so you can switch with minimal effort.

## Side-by-side API

| glitched-writer | @disclearing/flicker |
|-----------------|----------------------|
| `new GlitchedWriter(element, options)` | `createTextWriter(element, options)` |
| `writer.write(text)` | `writer.write(text)` |
| `writer.queueWrite(phrases, interval?, loop?)` | `writer.queue(phrases, intervalBetween?, loop?)` or `writer.endless(phrases, intervalBetween?)` |
| `writer.add(text)` | `writer.add(text)` |
| `writer.remove(n)` | `writer.remove(n)` |
| `writer.addCallback('finish', fn)` | `writer.on('complete', fn)` or `onComplete` in options |
| `writer.addCallback('step', fn)` | `writer.on('step', fn)` or `onStep(index, char, isComplete)` in options |
| `writer.addCallback('start', fn)` | `writer.on('start', fn)` or `onStart` in options |
| Custom event `gw-finished` | Custom event `flicker-writer-finished` with `detail: { text, length }` |
| Class `gw-writing` | Class `flicker-writing` + `data-flicker-state="writing"` |
| Presets (cosmic, neo, zalgo, etc.) | `getTextPreset('zalgo' | 'terminal' | 'neo' | 'cosmic' | 'horror' | 'encrypted' | 'nier' | 'default')` |
| Letterize / HTML support | `html: 'strip'` or `'preserve'`; `setLetterizedContentFromHtml(container, html)` for HTML strings |

## Flicker-only additions

- **`writer.writeAsync(text)`** — returns a `Promise` that resolves when the animation finishes.
- **`writer.on(event, fn)` / `writer.off(event, fn)`** — multiple listeners for `start`, `step`, `complete`, `destroy`, `visibilitychange`.
- **`writer.endless(phrases, intervalBetween?)`** — infinite loop over phrases.
- **`cursor: true | string | { char, blink }`** — typing cursor (optional blink via CSS).
- **`seed`** — deterministic animations (same seed = same pattern).
- **`respectReducedMotion`** and **`autoPauseOnHidden`** — accessibility and tab visibility.

## Migration steps

1. **Replace the constructor**  
   `const writer = new GlitchedWriter(el, opts)` → `const writer = createTextWriter(el, opts)`.

2. **Map options**  
   - Interval / timing → `interval`, `minInterval`, `maxInterval`, `humanLike`, `pauseOnSpaces`, `punctuationPauseMs`.  
   - Glyph pool → `glyphPool`.  
   - Mode (decode, typewriter, etc.) → `mode: 'scramble' | 'typewriter' | 'decode' | 'glyph-sub'`.  
   - Presets → use `getTextPreset('zalgo')` (or similar) and merge with your overrides.

3. **Replace callbacks**  
   - `addCallback('finish', fn)` → `writer.on('complete', fn)` or options `onComplete`.  
   - `addCallback('step', fn)` → `writer.on('step', fn)` or options `onStep`.  
   - `addCallback('start', fn)` → `writer.on('start', fn)` or options `onStart`.

4. **Replace event listeners**  
   If you listen for `gw-finished`, switch to `flicker-writer-finished` and use `e.detail.text` / `e.detail.length` instead of the previous payload.

5. **Replace CSS hooks**  
   Any selectors for `.gw-writing` or `data-gw-*` → `.flicker-writing` and `data-flicker-state`, `data-flicker-char-index`.

6. **Cleanup**  
   Call `writer.destroy()` when the component unmounts or the writer is no longer needed (same idea as disposing the glitched-writer instance).

## Vue users

If you used **vue-glitched-writer**, use the Vue adapter instead:

```js
import { useTextWriter, textWriterDirective, unmountTextWriterDirective } from '@disclearing/flicker/vue';
```

See [Framework adapters → Vue](./framework-adapters.md#vue-3).

## Minimal before/after

**Before (glitched-writer):**

```js
import GlitchedWriter from 'glitched-writer';

const writer = new GlitchedWriter(el, { interval: 80 });
writer.addCallback('finish', () => console.log('done'));
writer.write('Hello');
```

**After (flicker):**

```js
import { createTextWriter } from '@disclearing/flicker';

const writer = createTextWriter(el, { interval: 80 });
writer.on('complete', () => console.log('done'));
writer.write('Hello');
// On teardown: writer.destroy();
```

After this, you can adopt `writeAsync`, `cursor`, `seed`, and `html: 'preserve'` as needed.
