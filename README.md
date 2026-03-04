# flicker

Utility for flickering text, images, and DOM elements with configurable timing, intensity, and advanced image manipulation. Use it for glitch effects, loading states, image carousels, or attention-grabbing animations.

## Install

```bash
npm install flicker
```

## Basic Usage

### Flicker a single element

```js
import { createFlicker } from 'flicker';

const el = document.querySelector('.my-text');
const controller = createFlicker(el, { interval: 100 });

controller.start();
// later: controller.stop();
```

### By selector

```js
import { flickerElement, flickerSelector } from 'flicker';

// One element
const ctrl = flickerElement('#logo');
if (ctrl) ctrl.start();

// All matching elements
const controllers = flickerSelector('.flicker-me');
controllers.forEach((c) => c.start());
```

## Image Sequences (Advanced)

Cycle through multiple images with transitions, preloading, and effects.

### Basic image cycler

```js
import { createImageSequence } from 'flicker';

const img = document.querySelector('#slideshow');
const sequence = createImageSequence(img, {
  images: [
    '/img/frame1.jpg',
    '/img/frame2.jpg',
    '/img/frame3.jpg',
    '/img/frame4.jpg',
  ],
  interval: 500,
  transition: 'crossfade',
  transitionDuration: 300,
  loop: true,
  preload: true,
  onChange: (index, total, url) => {
    console.log(`Showing ${index + 1} of ${total}: ${url}`);
  },
});

sequence.start();
```

### Image sequence with selector

```js
import { imageSequence, imageSequenceAll } from 'flicker';

// Single element
const ctrl = imageSequence('#hero-image', {
  images: ['/img/a.jpg', '/img/b.jpg', '/img/c.jpg'],
  interval: 1000,
});
if (ctrl) ctrl.start();

// All matching elements
const ctrls = imageSequenceAll('.animated-image', {
  images: ['/img/1.jpg', '/img/2.jpg', '/img/3.jpg'],
  shuffle: true,
  randomInterval: true,
});
ctrls.forEach((c) => c.start());
```

### Transitions

Available transitions for image sequences:

- `'instant'` – Immediate swap (default)
- `'crossfade'` – Fade between images
- `'slide-left'` – Slide from right to left
- `'slide-right'` – Slide from left to right
- `'slide-up'` – Slide from bottom to top
- `'slide-down'` – Slide from top to bottom
- `'zoom'` – Zoom in/out transition
- `'flicker'` – Flicker effect during transition

### Image sequence options

| Option               | Type       | Default    | Description                                              |
|----------------------|------------|------------|----------------------------------------------------------|
| `images`             | `string[]` | required   | Array of image URLs to cycle through.                    |
| `interval`           | number     | 1000       | Ms between image changes.                                |
| `minInterval`        | number     | 500        | Min ms when `randomInterval` is true.                    |
| `maxInterval`        | number     | 2000       | Max ms when `randomInterval` is true.                    |
| `randomInterval`     | boolean    | false      | Use random interval in [min, max].                       |
| `transition`         | string     | 'instant'  | Transition type (see above).                             |
| `transitionDuration` | number     | 300        | Duration of transition in ms.                              |
| `loop`               | boolean    | true       | Whether to loop the sequence.                            |
| `shuffle`            | boolean    | false      | Randomize image order.                                   |
| `startIndex`         | number     | 0          | Start from this index.                                   |
| `direction`          | 1 \| -1     | 1          | Forward (1) or backward (-1) direction.                  |
| `preload`            | boolean    | true       | Preload images for smooth transitions.                   |
| `preloadAhead`       | number     | 2          | Number of images to preload ahead.                       |
| `duration`           | number     | —          | Stop after this many ms (optional).                      |
| `onChange`           | function   | —          | `(index, total, url) => void` on image change.             |
| `onComplete`         | function   | —          | Called when all images shown (non-looping).              |
| `onStop`             | function   | —          | Called when stopped.                                     |
| `onError`            | function   | —          | `(url, error) => void` on image load failure.            |

## Combined Flicker + Image Sequence

Glitch effect that flickers while cycling through images.

```js
import { createCombinedFlicker } from 'flicker';

const img = document.querySelector('#glitch-image');
const combo = createCombinedFlicker(img, {
  flicker: {
    interval: 50,
    randomInterval: true,
    minInterval: 30,
    maxInterval: 100,
    mode: 'opacity',
  },
  sequence: {
    images: ['/img/glitch1.jpg', '/img/glitch2.jpg', '/img/glitch3.jpg'],
    interval: 800,
    transition: 'flicker',
    loop: true,
  },
});

combo.start();

// Access state
console.log(combo.state); // { visible: true, imageIndex: 2, imageUrl: '/img/glitch3.jpg' }
```

## Preloading Utilities

Manually preload images for instant display:

```js
import { preloadImages, isImageCached, clearImageCache } from 'flicker';

// Preload a batch
await preloadImages(['/img/1.jpg', '/img/2.jpg', '/img/3.jpg']);

// Check if cached
if (isImageCached('/img/1.jpg')) {
  console.log('Ready to display');
}

// Clear cache when done
clearImageCache();
```

## Flicker Options (Basic)

| Option          | Type     | Default     | Description                                              |
|-----------------|----------|-------------|----------------------------------------------------------|
| `interval`      | number   | 80          | Ms between visibility toggles.                           |
| `minInterval`   | number   | 40          | Min ms when `randomInterval` is true.                    |
| `maxInterval`   | number   | 200         | Max ms when `randomInterval` is true.                    |
| `randomInterval`| boolean  | false       | Use random interval in [min, max].                       |
| `mode`          | string   | 'opacity'   | `'opacity'` \| `'visibility'` \| `'both'`.              |
| `offOpacity`    | number   | 0           | Opacity when "off" (0–1).                                |
| `duration`      | number   | —           | Stop after this many ms (optional).                      |
| `onTick`        | function | —           | Called each toggle with `(visible: boolean)`.            |
| `onStop`        | function | —           | Called when flicker stops.                               |

## Controllers

### `FlickerController`

- `start()` – Start flickering.
- `stop()` – Stop and restore visibility.
- `setOptions(options)` – Update options while running.
- `isRunning` – Boolean.

### `ImageSequenceController`

- `start()` – Start cycling.
- `stop()` – Stop completely.
- `pause()` – Pause cycling (keeps current image).
- `resume()` – Resume from pause.
- `jumpTo(index)` – Jump to specific image index.
- `next()` – Go to next image.
- `previous()` – Go to previous image.
- `setOptions(options)` – Update options.
- `preloadAll()` – Preload all images; returns Promise.
- `isRunning` – Boolean.
- `isPaused` – Boolean.
- `currentIndex` – Number (readonly).
- `totalImages` – Number (readonly).
- `currentImage` – String URL or null (readonly).

### `CombinedFlickerController`

Implements both interfaces plus:
- `state` – `{ visible: boolean, imageIndex: number, imageUrl: string | null }`

## Examples

### Random glitch effect on text

```js
import { createFlicker } from 'flicker';

const glitch = createFlicker(document.getElementById('title'), {
  randomInterval: true,
  minInterval: 50,
  maxInterval: 150,
  mode: 'both',
  duration: 3000,
  onStop: () => console.log('Glitch ended'),
});
glitch.start();
```

### Slideshow with crossfade

```js
import { createImageSequence } from 'flicker';

const slideshow = createImageSequence(document.getElementById('slideshow'), {
  images: ['/slides/1.jpg', '/slides/2.jpg', '/slides/3.jpg', '/slides/4.jpg'],
  interval: 4000,
  transition: 'crossfade',
  transitionDuration: 800,
  preload: true,
  preloadAhead: 2,
});
slideshow.start();
```

### Shuffle images with random timing

```js
import { createImageSequence } from 'flicker';

const randomShow = createImageSequence(document.getElementById('random'), {
  images: ['/img/a.jpg', '/img/b.jpg', '/img/c.jpg', '/img/d.jpg'],
  shuffle: true,
  randomInterval: true,
  minInterval: 200,
  maxInterval: 1500,
  transition: 'zoom',
  loop: false,
  onComplete: () => console.log('All images shown'),
});
randomShow.start();
```

### Heavy glitch with combined effect

```js
import { createCombinedFlicker } from 'flicker';

const heavyGlitch = createCombinedFlicker(document.getElementById('target'), {
  flicker: {
    interval: 30,
    randomInterval: true,
    minInterval: 10,
    maxInterval: 60,
    mode: 'both',
  },
  sequence: {
    images: ['/glitch/1.png', '/glitch/2.png', '/glitch/3.png'],
    interval: 200,
    transition: 'flicker',
    loop: true,
  },
});
heavyGlitch.start();
```

## License

MIT
