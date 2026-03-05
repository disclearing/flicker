/**
 * Svelte adapter: actions and optional store helpers for flicker.
 * Use with Svelte 4/5. Optional: install "svelte" as dependency.
 */

import { createFlicker } from '../flicker.js';
import { createImageSequence } from '../image-sequence.js';
import { createTextWriter } from '../text-writer.js';
import type { FlickerOptions, FlickerController } from '../types.js';
import type { ImageSequenceOptions, ImageSequenceController } from '../types.js';
import type { TextWriterOptions, TextWriterController } from '../types.js';

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

/**
 * Svelte action: use:textWriter={options} to bind a text writer to the node.
 * Returns { controller, update, destroy }; controller is the writer API (write, queue, etc.).
 */
export function textWriter(
  node: HTMLElement,
  options: TextWriterOptions = {}
): { destroy?: () => void; update?: (opts: TextWriterOptions) => void; controller: TextWriterController } {
  let ctrl = createTextWriter(node, options);
  const result: { destroy?: () => void; update?: (opts: TextWriterOptions) => void; controller: TextWriterController } = {
    controller: ctrl,
    update(opts: TextWriterOptions) {
      ctrl.destroy();
      ctrl = createTextWriter(node, opts);
      result.controller = ctrl;
    },
    destroy() {
      ctrl.destroy();
    },
  };
  return result;
}

/**
 * Create a text writer controller for use in Svelte (e.g. in onMount).
 */
export function createTextWriterController(
  element: HTMLElement,
  options: TextWriterOptions = {}
): TextWriterController {
  return createTextWriter(element, options);
}
