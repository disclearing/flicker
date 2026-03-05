# Installation

## Install the package

```bash
npm install @disclearing/flicker
```

Or with yarn / pnpm:

```bash
yarn add @disclearing/flicker
pnpm add @disclearing/flicker
```

## Package exports

The package is ESM-only and exposes these entry points:

| Subpath | Use for |
|--------|---------|
| `@disclearing/flicker` | Core API: flicker, text writer, image sequence, effects, presets, timeline, group, etc. |
| `@disclearing/flicker/react` | React 18+ hooks: `useFlicker`, `useTextWriter`, `useImageSequence`, `useTimeline` |
| `@disclearing/flicker/vue` | Vue 3 composables and directives: `useFlicker`, `useTextWriter`, `flickerDirective`, `textWriterDirective` |
| `@disclearing/flicker/svelte` | Svelte 4/5 actions: `flicker`, `textWriter`, `imageSequence` |
| `@disclearing/flicker/expo` | Expo / React Native: `useExpoFlicker`, `useExpoImageSequence` |

## Peer dependencies

Framework adapters declare optional peer dependencies. Install the ones you use:

- **React adapter**: `react` (e.g. `>=18.0.0`)
- **Vue adapter**: `vue` (e.g. `>=3.0.0`)
- **Svelte adapter**: `svelte` (e.g. `>=4.0.0`)
- **Expo adapter**: `expo` and `react-native` (e.g. `expo>=50`, `react-native>=0.73`)

You can use the core API without any framework dependency.

## TypeScript

Types are included via the package `types` field. No separate `@types` package is required.
