# Presets and effects

## Flicker presets

Ready-made option bundles for DOM flicker:

| Preset | Description |
|--------|-------------|
| `neonSign` | Slow, soft flicker with slight glow |
| `horrorGlitch` | Fast, harsh flicker |
| `oldTV` | Medium flicker, scan-line feel |
| `warningAlarm` | Regular, attention-grabbing blink |

```js
import { getFlickerPreset, createFlicker } from '@disclearing/flicker';

const opts = getFlickerPreset('horrorGlitch', { interval: 40 });
createFlicker(el, opts).start();
```

## Image sequence presets

| Preset | Description |
|--------|-------------|
| `neon` | Slow crossfade |
| `horror` | Fast flicker transition |
| `oldTV` | Slide + flicker |
| `warning` | Instant swap, regular interval |

```js
import { getSequencePreset, createImageSequence } from '@disclearing/flicker';

const opts = getSequencePreset('horror', { images: ['/a.jpg', '/b.jpg'] });
createImageSequence(img, opts).start();
```

## Text writer presets

| Preset | Description |
|--------|-------------|
| `zalgo` | Decode mode with combining marks |
| `terminal` | Typewriter with blocky glyph pool |
| `neo` | Scramble with symbol pool |
| `cosmic` | Decode with cosmic symbols |
| `horror` | Fast scramble |
| `encrypted` | Decode with hex/block chars |
| `nier` | Decode with half-width katakana style |
| `default` | Scramble with default pool |

```js
import { getTextPreset, createTextWriter } from '@disclearing/flicker';

const opts = getTextPreset('zalgo', { interval: 40 });
createTextWriter(el, opts).write('Hello world');
```

## Combined preset (flicker + sequence)

Use a flicker preset and a sequence preset together (e.g. for a glitchy image carousel):

```js
import { getCombinedPreset, createCombinedFlicker } from '@disclearing/flicker';

const combined = getCombinedPreset('horrorGlitch', 'horror', {
  sequence: { images: ['/1.jpg', '/2.jpg'] },
});
createCombinedFlicker(img, combined).start();
```

## CSS filters

Apply blur, contrast, hue, saturation, chromatic aberration, or RGB split to elements (e.g. during the “off” phase of flicker):

```js
import { applyFilters, applyFullFilters, buildFilterString } from '@disclearing/flicker';

applyFilters(el, { blur: 2, contrast: 1.2 });
applyFullFilters(el, { chromaticAberration: 1.5, rgbSplit: [1, 0, -1, 0, 0, 0] });
```

Use `filters` in flicker options to apply during the off phase:

```js
createFlicker(el, {
  interval: 80,
  filters: { contrast: 1.3, saturate: 0.9, chromaticAberration: 1.5 },
}).start();
```

## One-shot text effects

Without the full writer, you can run single effects on a container:

- `runScrambleReveal(container, options)` — scramble then reveal; returns stop function
- `runTypewriter(container, options)` — typewriter; returns stop function
- `runDecode(container, options)` — decode (resolve from random to final); returns stop function
- `runGlyphSubstitution(container, options)` — continuous glyph substitution; returns stop function
- `preparePerCharFlicker(container)` — wrap text in per-character spans for custom flicker

Options support `interval`, `glyphPool`, `onStep`, `onComplete`, `decodeEntitiesIn`, `startFromIndex`, `cursor`, `random` (for seed), etc.

## Plugins (custom transitions and effects)

Register custom image transitions and per-tick effects:

```js
import { registerTransition, registerEffect, createFlicker, createImageSequence } from '@disclearing/flicker';

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

Built-in transitions: `instant`, `crossfade`, `slide-left` / `slide-right` / `slide-up` / `slide-down`, `zoom`, `flicker`.
