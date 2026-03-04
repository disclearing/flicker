/**
 * Vue 3 adapter: composition helpers and directive for flicker.
 * Use with Vue 3. Optional: install "vue" as dependency.
 * Pass a ref-like object { value: HTMLElement | null } to useFlicker.
 */

import { createFlicker } from '../flicker.js';
import { createImageSequence } from '../image-sequence.js';
import type { FlickerOptions, FlickerController } from '../types.js';
import type { ImageSequenceOptions, ImageSequenceController } from '../types.js';

export type RefLike<T> = { value: T };

/**
 * Composition: create flicker for an element ref. Call start() when ref is set (e.g. in onMounted).
 */
export function useFlicker(
  elementRef: RefLike<HTMLElement | HTMLImageElement | null | undefined>,
  options: FlickerOptions = {}
): { controller: RefLike<FlickerController | null>; start: () => void; stop: () => void } {
  const controllerRef: RefLike<FlickerController | null> = { value: null };

  function start() {
    if (typeof window === 'undefined') return;
    const el = elementRef.value;
    if (!el) return;
    controllerRef.value?.destroy();
    controllerRef.value = createFlicker(el, options);
    controllerRef.value.start();
  }

  function stop() {
    controllerRef.value?.stop();
    controllerRef.value?.destroy();
    controllerRef.value = null;
  }

  return { controller: controllerRef, start, stop };
}

/**
 * Composition: image sequence for an img ref.
 */
export function useImageSequence(
  elementRef: RefLike<HTMLImageElement | null | undefined>,
  options: ImageSequenceOptions
): { controller: RefLike<ImageSequenceController | null>; start: () => void; stop: () => void } {
  const controllerRef: RefLike<ImageSequenceController | null> = { value: null };

  function start() {
    if (typeof window === 'undefined') return;
    const el = elementRef.value;
    if (!el || !options.images?.length) return;
    controllerRef.value?.destroy();
    controllerRef.value = createImageSequence(el, options);
    controllerRef.value.start();
  }

  function stop() {
    controllerRef.value?.stop();
    controllerRef.value?.destroy();
    controllerRef.value = null;
  }

  return { controller: controllerRef, start, stop };
}

/**
 * Vue directive: v-flicker="options" to run flicker on the element.
 */
export function flickerDirective(
  el: HTMLElement | HTMLImageElement,
  binding: { value?: FlickerOptions }
): void {
  const options = binding.value ?? {};
  const ctrl = createFlicker(el, options);
  ctrl.start();
  (el as HTMLElement & { _flickerCtrl?: FlickerController })._flickerCtrl = ctrl;
}

export function unmountFlickerDirective(el: HTMLElement): void {
  const ctrl = (el as HTMLElement & { _flickerCtrl?: FlickerController })._flickerCtrl;
  ctrl?.destroy();
}
