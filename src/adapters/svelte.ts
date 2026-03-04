/**
 * Svelte adapter: actions and optional store helpers for flicker.
 * Use with Svelte 4/5. Optional: install "svelte" as dependency.
 */

import { createFlicker } from '../flicker.js';
import { createImageSequence } from '../image-sequence.js';
import type { FlickerOptions, FlickerController } from '../types.js';
import type { ImageSequenceOptions, ImageSequenceController } from '../types.js';

/**
 * Svelte action: use:flicker={{ options }} to run flicker on the node.
 */
export function flicker(
  node: HTMLElement | HTMLImageElement,
  options: FlickerOptions = {}
): { destroy?: () => void; update?: (opts: FlickerOptions) => void } {
  const ctrl = createFlicker(node, options);
  ctrl.start();
  return {
    update(opts: FlickerOptions) {
      ctrl.setOptions(opts);
    },
    destroy() {
      ctrl.destroy();
    },
  };
}

/**
 * Svelte action: use:imageSequence={{ options }} for img elements.
 */
export function imageSequence(
  node: HTMLImageElement,
  options: ImageSequenceOptions
): { destroy?: () => void; update?: (opts: ImageSequenceOptions) => void } {
  if (!options.images?.length) return {};
  const ctrl = createImageSequence(node, options);
  ctrl.start();
  return {
    update(opts: ImageSequenceOptions) {
      ctrl.setOptions(opts);
    },
    destroy() {
      ctrl.destroy();
    },
  };
}

/**
 * Create a flicker controller for use in Svelte (e.g. in onMount).
 */
export function createFlickerController(
  element: HTMLElement | HTMLImageElement,
  options: FlickerOptions = {}
): FlickerController {
  return createFlicker(element, options);
}

/**
 * Create an image sequence controller for use in Svelte.
 */
export function createImageSequenceController(
  element: HTMLImageElement,
  options: ImageSequenceOptions
): ImageSequenceController {
  return createImageSequence(element, options);
}
