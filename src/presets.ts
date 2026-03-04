/**
 * Built-in presets: option bundles for common flicker and image-sequence effects.
 */

import type { FlickerOptions, ImageSequenceOptions, CombinedFlickerOptions, FilterOptions, TextWriterOptions, WriterMode } from './types.js';

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

// --- Text writer presets (glitch/scramble/typewriter) ---

const ZALGO_POOL = '\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309\u030A\u030B\u030C\u030D\u030E\u030F\u0310\u0311\u0312\u0313\u0314\u0315\u0316\u0317\u0318\u0319\u031A\u031B\u031C\u031D\u031E\u031F\u0320\u0321\u0322\u0323\u0324\u0325\u0326\u0327\u0328\u0329\u032A\u032B\u032C\u032D\u032E\u032F\u0330\u0331\u0332\u0333\u0334\u0335\u0336\u0337\u0338\u0339\u033A\u033B\u033C\u033D\u033E\u033F';
const TERMINAL_POOL = '01█▓▒░▀▄▌▐■□▪▫●○◆◇★☆';
const NEO_POOL = '!@#$%^&*_+-=[]{}|;:,.<>?/~`';
const COSMIC_POOL = '✦✧★☆♦♠♥♣♤♡♢♧∞§¶†‡';

export interface PresetTextWriterOptions extends Partial<TextWriterOptions> {}

export const textPresetZalgo: PresetTextWriterOptions = {
  mode: 'decode' as WriterMode,
  glyphPool: ZALGO_POOL,
  interval: 45,
  decodeDuration: 50,
  html: 'strip',
};

export const textPresetTerminal: PresetTextWriterOptions = {
  mode: 'typewriter' as WriterMode,
  glyphPool: TERMINAL_POOL,
  interval: 60,
  humanLike: true,
  minInterval: 40,
  maxInterval: 120,
  pauseOnSpaces: 80,
  punctuationPauseMs: 150,
  html: 'strip',
};

export const textPresetNeo: PresetTextWriterOptions = {
  mode: 'scramble' as WriterMode,
  glyphPool: NEO_POOL,
  interval: 50,
  html: 'strip',
};

export const textPresetCosmic: PresetTextWriterOptions = {
  mode: 'decode' as WriterMode,
  glyphPool: COSMIC_POOL,
  interval: 70,
  decodeDuration: 60,
  html: 'strip',
};

export const textPresetHorror: PresetTextWriterOptions = {
  mode: 'scramble' as WriterMode,
  glyphPool: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
  interval: 40,
  html: 'strip',
};

export const textPresets = {
  zalgo: textPresetZalgo,
  terminal: textPresetTerminal,
  neo: textPresetNeo,
  cosmic: textPresetCosmic,
  horror: textPresetHorror,
} as const;

export type TextPresetName = keyof typeof textPresets;

/**
 * Resolve a text writer preset by name and merge with user options.
 */
export function getTextPreset(name: TextPresetName, overrides: Partial<TextWriterOptions> = {}): TextWriterOptions {
  const base = textPresets[name] ?? {};
  return { ...base, ...overrides } as TextWriterOptions;
}
