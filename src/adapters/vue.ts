/**
 * Vue 3 adapter: composition helpers and directive for flicker.
 * Use with Vue 3. Optional: install "vue" as dependency.
 * Pass a ref-like object { value: HTMLElement | null } to useFlicker.
 */

import { createFlicker } from '../flicker.js';
import { createImageSequence } from '../image-sequence.js';
import { createTextWriter } from '../text-writer.js';
import type { FlickerOptions, FlickerController } from '../types.js';
import type { ImageSequenceOptions, ImageSequenceController } from '../types.js';
import type { TextWriterOptions, TextWriterController } from '../types.js';

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

/**
 * Composition: create text writer for an element ref. Call write/queue etc. when ref is set.
 */
export function useTextWriter(
  elementRef: RefLike<HTMLElement | null | undefined>,
  options: TextWriterOptions = {}
): {
  controller: RefLike<TextWriterController | null>;
  write: (text: string) => void;
  queue: (phrases: string[], intervalBetween?: number, loop?: boolean) => void;
  writeAsync: (text: string) => Promise<void>;
  endless: (phrases: string[], intervalBetween?: number) => void;
  add: (text: string) => void;
  remove: (n: number) => void;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
} {
  const controllerRef: RefLike<TextWriterController | null> = { value: null };

  function ensureController(): TextWriterController | null {
    if (typeof window === 'undefined') return null;
    const el = elementRef.value;
    if (!el) return null;
    controllerRef.value?.destroy();
    controllerRef.value = createTextWriter(el, options);
    return controllerRef.value;
  }

  return {
    controller: controllerRef,
    write(text: string) {
      ensureController()?.write(text);
    },
    queue(phrases: string[], intervalBetween?: number, loop?: boolean) {
      ensureController()?.queue(phrases, intervalBetween, loop);
    },
    async writeAsync(text: string) {
      return ensureController()?.writeAsync(text) ?? Promise.resolve();
    },
    endless(phrases: string[], intervalBetween?: number) {
      ensureController()?.endless(phrases, intervalBetween);
    },
    add(text: string) {
      controllerRef.value?.add(text);
    },
    remove(n: number) {
      controllerRef.value?.remove(n);
    },
    start() {
      controllerRef.value?.start();
    },
    stop() {
      controllerRef.value?.stop();
    },
    pause() {
      controllerRef.value?.pause();
    },
    resume() {
      controllerRef.value?.resume();
    },
    destroy() {
      controllerRef.value?.destroy();
      controllerRef.value = null;
    },
  };
}

/**
 * Vue directive: v-text-writer="options" to bind a text writer to the element.
 */
export function textWriterDirective(
  el: HTMLElement,
  binding: { value?: TextWriterOptions }
): void {
  const options = binding.value ?? {};
  const ctrl = createTextWriter(el, options);
  (el as HTMLElement & { _textWriterCtrl?: TextWriterController })._textWriterCtrl = ctrl;
}

export function unmountTextWriterDirective(el: HTMLElement): void {
  const ctrl = (el as HTMLElement & { _textWriterCtrl?: TextWriterController })._textWriterCtrl;
  ctrl?.destroy();
}
