# Framework adapters

Use flicker and the text writer inside React, Vue, Svelte, or Expo/React Native via dedicated adapters. Install the corresponding peer dependency when using an adapter.

## React

Import from `@disclearing/flicker/react`. Requires `react` (e.g. 18+).

### Flicker

```jsx
import { useRef, useEffect } from 'react';
import { useFlickerController } from '@disclearing/flicker/react';

function FlickerText() {
  const ref = useRef(null);
  const ctrlRef = useFlickerController(ref, { interval: 100 });

  useEffect(() => {
    ctrlRef.current?.start();
    return () => ctrlRef.current?.destroy();
  }, []);

  return <div ref={ref}>Flickering</div>;
}
```

### Text writer

```jsx
import { useRef, useEffect } from 'react';
import { useTextWriter } from '@disclearing/flicker/react';

function WriterDemo() {
  const ref = useRef(null);
  const writerRef = useTextWriter(ref, { mode: 'typewriter', cursor: true });

  useEffect(() => {
    writerRef.current?.write('Hello world');
  }, []);

  return <div ref={ref} />;
}
```

### Image sequence

```jsx
import { useRef } from 'react';
import { useImageSequence } from '@disclearing/flicker/react';

function ImageCycle() {
  const ref = useRef(null);
  useImageSequence(ref, { images: ['/a.jpg', '/b.jpg'], interval: 500 });
  return <img ref={ref} alt="" />;
}
```

### Timeline

```jsx
import { useTimeline } from '@disclearing/flicker/react';

const steps = [
  { type: 'flicker', element: titleEl, options: { interval: 50 }, duration: 300 },
  { type: 'pause', duration: 500 },
];
const timeline = useTimeline(steps, { onComplete: () => console.log('done') });
```

---

## Vue 3

Import from `@disclearing/flicker/vue`. Requires `vue` (e.g. 3.x). Use a ref-like object `{ value: HTMLElement | null }`.

### Flicker (composable)

```js
import { ref, onMounted, onUnmounted } from 'vue';
import { useFlicker } from '@disclearing/flicker/vue';

const elRef = ref(null);
const { start, stop } = useFlicker(elRef, { interval: 100 });

onMounted(() => start());
onUnmounted(() => stop());
```

### Flicker (directive)

```js
import { flickerDirective, unmountFlickerDirective } from '@disclearing/flicker/vue';

app.directive('flicker', {
  mounted: flickerDirective,
  unmounted: unmountFlickerDirective,
});
```

```html
<div v-flicker="{ interval: 100 }">Flickering</div>
```

### Text writer (composable)

```js
import { ref, onMounted, onUnmounted } from 'vue';
import { useTextWriter } from '@disclearing/flicker/vue';

const elRef = ref(null);
const { write, writeAsync, queue, endless, destroy } = useTextWriter(elRef, {
  mode: 'scramble',
  cursor: { blink: true },
});

onMounted(() => write('Hello'));
onUnmounted(() => destroy());
```

### Text writer (directive)

```js
import { textWriterDirective, unmountTextWriterDirective } from '@disclearing/flicker/vue';

app.directive('text-writer', {
  mounted: textWriterDirective,
  unmounted: unmountTextWriterDirective,
});
```

```html
<div v-text-writer="{ mode: 'typewriter', cursor: true }"></div>
```

You can store the controller reference from the directive by reading the element’s `_textWriterCtrl` if you need to call `write`/`queue` programmatically.

---

## Svelte

Import from `@disclearing/flicker/svelte`. Works with Svelte 4/5.

### Flicker (action)

```svelte
<script>
  import { flicker } from '@disclearing/flicker/svelte';
</script>
<div use:flicker={{ interval: 100 }}>Flickering</div>
```

### Text writer (action)

```svelte
<script>
  import { textWriter } from '@disclearing/flicker/svelte';
  let opts = { mode: 'typewriter', cursor: { char: '|', blink: true } };
</script>
<div use:textWriter={opts} bind:this={el}></div>
```

To call `write` or `queue` from script, use the action’s return value:

```svelte
<script>
  import { textWriter } from '@disclearing/flicker/svelte';
  let node;
  let writerCtrl;
  $: if (node) {
    const result = textWriter(node, { mode: 'scramble' });
    writerCtrl = result.controller;
    writerCtrl.write('Hello');
  }
</script>
<div bind:this={node} use:textWriter={{ mode: 'scramble' }}></div>
```

Or use `createTextWriterController` in `onMount`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { createTextWriterController } from '@disclearing/flicker/svelte';
  let el;
  let writer;
  onMount(() => {
    if (el) {
      writer = createTextWriterController(el, { mode: 'typewriter' });
      writer.write('Hello');
    }
    return () => writer?.destroy();
  });
</script>
<div bind:this={el}></div>
```

### Image sequence (action)

```svelte
<img use:imageSequence={{ images: ['/a.jpg', '/b.jpg'], interval: 500 }} alt="" />
```

---

## Expo / React Native

Import from `@disclearing/flicker/expo`. Requires `expo` and `react-native`.

### Flicker

```tsx
import { useExpoFlicker } from '@disclearing/flicker/expo';

const { opacity, controller } = useExpoFlicker({ interval: 80, offOpacity: 0.15 });

useEffect(() => {
  controller.start();
  return () => controller.destroy();
}, []);

return <View style={{ opacity }}>...</View>;
```

### Image sequence

```tsx
import { useExpoImageSequence } from '@disclearing/flicker/expo';

const { currentImage, controller } = useExpoImageSequence({
  images: ['https://example.com/1.png', 'https://example.com/2.png'],
  interval: 500,
  loop: true,
});

useEffect(() => {
  controller.start();
  return () => controller.destroy();
}, []);

return (
  <Image
    source={{ uri: currentImage ?? undefined }}
    style={{ width: 200, height: 200 }}
  />
);
```

Combine both for a glitch-style image:

```tsx
const { currentImage, controller: seq } = useExpoImageSequence({ ... });
const { opacity, controller: flicker } = useExpoFlicker({ interval: 80, offOpacity: 0.15 });
// Start both, render <Image source={{ uri: currentImage }} style={{ opacity }} />
```
