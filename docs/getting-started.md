# Getting started

## Flicker a single element

Toggle visibility/opacity of any DOM element (text, image, or div) on a timer:

```js
import { createFlicker } from '@disclearing/flicker';

const el = document.querySelector('.my-text');
const controller = createFlicker(el, { interval: 100 });

controller.start();
// Later: controller.stop(); controller.destroy();
```

## By selector (SSR-safe)

Use selectors when the DOM might not exist yet (e.g. SSR or before mount):

```js
import { flickerElement, flickerSelector } from '@disclearing/flicker';

const ctrl = flickerElement('#logo');
if (ctrl) ctrl.start();

const controllers = flickerSelector('.flicker-me');
controllers.forEach((c) => c.start());
```

## Basic options

| Option | Default | Description |
|--------|---------|-------------|
| `interval` | `80` | Milliseconds between visibility toggles |
| `minInterval` / `maxInterval` | `40` / `200` | Bounds when using random interval |
| `randomInterval` | `false` | Use random interval within bounds for organic flicker |
| `mode` | `'opacity'` | `'opacity'` \| `'visibility'` \| `'both'` |
| `offOpacity` | `0` | Opacity when “off” (0–1) |
| `duration` | — | Optional max duration in ms; flicker stops after this |
| `engine` | `'timeout'` | `'timeout'` or `'raf'` |
| `respectReducedMotion` | `true` | Honor `prefers-reduced-motion` |
| `autoPauseOnHidden` | `true` | Pause when tab is hidden |

## Lifecycle and cleanup

Always call **`destroy()`** when you no longer need the controller (e.g. component unmount) so timers and listeners are cleared.

```js
const controller = createFlicker(el, { interval: 100 });
controller.start();

// On teardown:
controller.stop();
controller.destroy();
```

## Next steps

- **[Text writer](./text-writer.md)** — Glitch/typewriter/decode text with `createTextWriter`
- **[Presets](./presets-and-effects.md)** — Use `getFlickerPreset('horrorGlitch')` and similar for ready-made looks
