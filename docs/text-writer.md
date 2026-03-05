# Text writer

The **text writer** is a unified API for animating text: glitch (scramble), typewriter, decode, or glyph substitution. It supports `write`, `queue`, `writeAsync`, `endless`, `add`, `remove`, cursor, seed, and HTML preservation.

## Basic usage

```js
import { createTextWriter, getTextPreset } from '@disclearing/flicker';

const el = document.querySelector('.text-target');
const writer = createTextWriter(el, { mode: 'scramble', interval: 60 });

writer.write('Hello world');
```

## API overview

| Method | Description |
|--------|-------------|
| `write(text)` | Replace content and animate in (scramble/typewriter/decode) |
| `writeAsync(text)` | Same as `write` but returns a `Promise` that resolves when the animation finishes |
| `queue(phrases, intervalBetween?, loop?)` | Play multiple strings in order; optional delay between phrases and loop |
| `endless(phrases, intervalBetween?)` | Same as `queue(phrases, intervalBetween, true)` — infinite loop |
| `add(text)` | Append text and animate only the new part |
| `remove(n)` | Remove the last `n` characters |
| `on(event, fn)` / `off(event, fn)` | Subscribe to `start`, `step`, `complete`, `destroy`, `visibilitychange` |
| `start()` / `stop()` / `pause()` / `resume()` / `destroy()` | Control lifecycle |

## Modes

| Mode | Description |
|------|-------------|
| `'scramble'` | Replace each character with random glyphs, then reveal one by one |
| `'typewriter'` | Reveal one character at a time; supports human-like variance and punctuation pause |
| `'decode'` | Each character “resolves” from random glyphs to the final character (decrypt-style) |
| `'glyph-sub'` | Continuously substitute characters with random glyphs from the pool |

Example with preset:

```js
const writer = createTextWriter(el, getTextPreset('zalgo'));
writer.write('Glitch text');
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `mode` | `'scramble'` | `'scramble'` \| `'typewriter'` \| `'decode'` \| `'glyph-sub'` |
| `glyphPool` | `'!@#$%^&*()_+-=...'` | Characters used for scramble/decode/glyph-sub |
| `interval` | `80` | Base interval per character (ms) |
| `minInterval` / `maxInterval` | — | Bounds for human-like variance |
| `humanLike` | `false` | Add per-character timing variance (typewriter) |
| `pauseOnSpaces` | — | Extra pause after spaces in ms (typewriter) |
| `punctuationPauseMs` | — | Extra pause after punctuation (typewriter) |
| `cursor` | — | `true` \| `'|'` \| `{ char?, blink? }` — typing cursor for typewriter/decode |
| `seed` | — | Number for deterministic animations (same seed = same pattern) |
| `html` | `'strip'` | `'strip'` or `'preserve'` — preserve tags when writing e.g. `'<b>Hi</b>'` |
| `decodeDuration` | `60` | Ms per character “decode” phase in decode mode |
| `respectReducedMotion` | `true` | Honor `prefers-reduced-motion` |
| `autoPauseOnHidden` | `true` | Pause when tab is hidden |
| `onStep(index, char, isComplete)` | — | Callback each character |
| `onComplete` / `onStart` / `onDestroy` / `onVisibilityChange` | — | Lifecycle callbacks |

## Cursor

Show a typing cursor during typewriter or decode:

```js
createTextWriter(el, { mode: 'typewriter', cursor: true });           // static '|'
createTextWriter(el, { mode: 'typewriter', cursor: '▌' });            // custom char
createTextWriter(el, { mode: 'typewriter', cursor: { char: '|', blink: true } }); // blinking
```

Add CSS for blinking:

```css
.flicker-cursor-blink {
  animation: flicker-cursor-blink 0.8s step-end infinite;
}
@keyframes flicker-cursor-blink {
  50% { opacity: 0; }
}
```

## Deterministic animation (seed)

Use `seed` for reproducible animations (e.g. tests or replay):

```js
createTextWriter(el, { mode: 'scramble', seed: 42 }).write('Same pattern every time');
```

## HTML with preserved tags

When `html: 'preserve'` and the string contains tags, structure is preserved and only text nodes are letterized:

```js
createTextWriter(el, { html: 'preserve' }).write('<b>Hello</b> <i>world</i>');
// Renders as bold “Hello” and italic “world” with per-character animation
```

## Custom event

When a write finishes, the element dispatches `flicker-writer-finished` so you can listen without callbacks:

```js
el.addEventListener('flicker-writer-finished', (e) => {
  console.log(e.detail); // { text, length }
});
```

## Events (on / off)

Multiple listeners per event:

```js
writer.on('complete', () => console.log('done'));
writer.on('step', (index, char, isComplete) => { /* ... */ });
writer.off('complete', handler);
```

Events: `start`, `step`, `complete`, `destroy`, `visibilitychange`.

## Text presets

Use built-in presets for common looks:

```js
import { getTextPreset, createTextWriter } from '@disclearing/flicker';

const presets = ['zalgo', 'terminal', 'neo', 'cosmic', 'horror', 'encrypted', 'nier', 'default'];
const writer = createTextWriter(el, getTextPreset('terminal', { interval: 50 }));
writer.write('Terminal style');
```

## Helpers

- `decodeEntities(str)` — Decode HTML entities (`&#60;`, `&amp;`, etc.).
- `letterizeToFragment(text)` — Return a document fragment of per-character spans (non-destructive).
- `setLetterizedContent(container, text)` — Set and letterize plain text in a container.
- `setLetterizedContentFromHtml(container, htmlString)` — Parse HTML string and letterize only text nodes.
- `createSeededRandom(seed)` — Return a deterministic `random()` for use in custom effects.
