# @disclearing/flicker — Documentation

Documentation for **@disclearing/flicker**: utilities for flickering text, images, and DOM elements with configurable timing, presets, text writer (glitch/typewriter/decode), and framework adapters.

## Contents

- **[Installation](./installation.md)** — Install and package exports
- **[Getting started](./getting-started.md)** — Basic flicker, selectors, options
- **[Text writer](./text-writer.md)** — `createTextWriter`: write, queue, writeAsync, endless, cursor, seed, HTML preserve, presets
- **[Framework adapters](./framework-adapters.md)** — React, Vue, Svelte, Expo usage
- **[Presets and effects](./presets-and-effects.md)** — Flicker/sequence/text presets, CSS filters, plugins
- **[Advanced](./advanced.md)** — Timeline, group, audio-reactive, canvas/WebGL/WebGPU, direct WebGPU (device, compute, 3D), validation
- **[Migration from glitched-writer](./migration-from-glitched-writer.md)** — Side-by-side API comparison and migration checklist

## Quick links

| Use case | Entry point |
|----------|-------------|
| Flicker a DOM element | `createFlicker(el, options)` |
| Glitch/typewriter text | `createTextWriter(el, options)` + presets |
| Image sequence | `createImageSequence(img, { images, ... })` |
| React | `@disclearing/flicker/react` → `useFlicker`, `useTextWriter` |
| Vue 3 | `@disclearing/flicker/vue` → `useFlicker`, `useTextWriter`, directives |
| Svelte | `@disclearing/flicker/svelte` → `flicker`, `textWriter` actions |
| Expo / RN | `@disclearing/flicker/expo` → `useExpoFlicker`, `useExpoImageSequence` |
| Direct WebGPU | `@disclearing/flicker/webgpu` → `createWebGPULitSceneRenderer`, `createWebGPUOrbitControls`, `createWebGPUTextureFromSource` |
