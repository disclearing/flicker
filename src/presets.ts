/**
 * Built-in presets: option bundles for common flicker and image-sequence effects.
 */

import type { FlickerOptions, ImageSequenceOptions, CombinedFlickerOptions, FilterOptions } from './types.js';

export interface PresetFlickerOptions extends Partial<FlickerOptions> {}
export interface PresetSequenceOptions extends Partial<Omit<ImageSequenceOptions, 'images'>> {}

/** Neon sign: slow, soft flicker with slight glow. */
export const neonSign: PresetFlickerOptions = {
  interval: 120,
  minInterval: 80,
  maxInterval: 200,
  randomInterval: true,
  mode: 'opacity',
  offOpacity: 0.4,
  engine: 'timeout',
  filters: { blur: 0, contrast: 1.1, saturate: 1.2 } as FilterOptions,
};

/** Horror / glitch: fast, harsh flicker. */
export const horrorGlitch: PresetFlickerOptions = {
  interval: 50,
  minInterval: 20,
  maxInterval: 100,
  randomInterval: true,
  mode: 'both',
  offOpacity: 0,
  engine: 'timeout',
  filters: { contrast: 1.3, saturate: 0.9, chromaticAberration: 1.5 } as FilterOptions,
};

/** Old TV: medium flicker with scan-line feel. */
export const oldTV: PresetFlickerOptions = {
  interval: 90,
  minInterval: 60,
  maxInterval: 140,
  randomInterval: true,
  mode: 'opacity',
  offOpacity: 0.15,
  engine: 'timeout',
  filters: { contrast: 1.1, saturate: 0.95 } as FilterOptions,
};

/** Warning / alarm: regular, attention-grabbing blink. */
export const warningAlarm: PresetFlickerOptions = {
  interval: 500,
  randomInterval: false,
  mode: 'opacity',
  offOpacity: 0,
  engine: 'timeout',
};

/** Preset name to options map. */
export const flickerPresets = {
  neonSign,
  horrorGlitch,
  oldTV,
  warningAlarm,
} as const;

export type FlickerPresetName = keyof typeof flickerPresets;

/**
 * Resolve a preset by name and merge with user options.
 */
export function getFlickerPreset(name: FlickerPresetName, overrides: Partial<FlickerOptions> = {}): FlickerOptions {
  const base = flickerPresets[name] ?? {};
  return { ...base, ...overrides } as FlickerOptions;
}

/** Image sequence preset: neon (slow crossfade). */
export const sequenceNeon: PresetSequenceOptions = {
  interval: 2000,
  transition: 'crossfade',
  transitionDuration: 600,
  loop: true,
  randomInterval: false,
};

/** Image sequence preset: horror (fast flicker transition). */
export const sequenceHorror: PresetSequenceOptions = {
  interval: 400,
  transition: 'flicker',
  transitionDuration: 200,
  loop: true,
  randomInterval: true,
  minInterval: 200,
  maxInterval: 600,
};

/** Image sequence preset: old TV (slide + flicker). */
export const sequenceOldTV: PresetSequenceOptions = {
  interval: 3000,
  transition: 'slide-left',
  transitionDuration: 500,
  loop: true,
};

/** Image sequence preset: warning (instant swap, regular interval). */
export const sequenceWarning: PresetSequenceOptions = {
  interval: 800,
  transition: 'instant',
  loop: true,
};

export const sequencePresets = {
  neon: sequenceNeon,
  horror: sequenceHorror,
  oldTV: sequenceOldTV,
  warning: sequenceWarning,
} as const;

export type SequencePresetName = keyof typeof sequencePresets;

/**
 * Resolve a sequence preset by name and merge with user options (including images).
 */
export function getSequencePreset(name: SequencePresetName, overrides: Partial<ImageSequenceOptions> = {}): ImageSequenceOptions {
  const base = sequencePresets[name] ?? {};
  return { ...base, ...overrides } as ImageSequenceOptions;
}

/**
 * Combined preset: flicker + sequence for full effect.
 */
export function getCombinedPreset(
  flickerPresetName: FlickerPresetName,
  sequencePresetName: SequencePresetName,
  overrides: { flicker?: Partial<FlickerOptions>; sequence?: Partial<ImageSequenceOptions> } = {}
): CombinedFlickerOptions {
  return {
    flicker: getFlickerPreset(flickerPresetName, overrides.flicker),
    sequence: getSequencePreset(sequencePresetName, overrides.sequence),
  };
}
