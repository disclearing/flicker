/**
 * React adapter: hooks for flicker, image sequence, and timeline.
 * Use with React 18+. Optional: install "react" as dependency.
 */

import { useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { createFlicker } from '../flicker.js';
import { createImageSequence } from '../image-sequence.js';
import { createTimeline } from '../timeline.js';
import { createTextWriter } from '../text-writer.js';
import type { FlickerOptions, FlickerController } from '../types.js';
import type { ImageSequenceOptions, ImageSequenceController } from '../types.js';
import type { TextWriterOptions, TextWriterController } from '../types.js';
import type { TimelineStep, TimelineOptions, TimelineController } from '../timeline.js';

/**
 * Hook: bind flicker to an element ref. Cleans up on unmount.
 */
export function useFlicker<T extends HTMLElement | HTMLImageElement>(
  ref: RefObject<T | null>,
  options: FlickerOptions = {}
): FlickerController | null {
  const controllerRef = useRef<FlickerController | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    controllerRef.current = createFlicker(el, optsRef.current);
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  return controllerRef.current;
}

/**
 * Hook: run flicker when ref is set; returns a ref holding the controller.
 */
export function useFlickerController<T extends HTMLElement | HTMLImageElement>(
  ref: RefObject<T | null>,
  options: FlickerOptions = {}
): RefObject<FlickerController | null> {
  const controllerRef = useRef<FlickerController | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      return;
    }
    const controller = createFlicker(el, optsRef.current);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);
  return controllerRef;
}

/**
 * Hook: image sequence on an img ref.
 */
export function useImageSequence(
  ref: RefObject<HTMLImageElement | null>,
  options: ImageSequenceOptions
): ImageSequenceController | null {
  const controllerRef = useRef<ImageSequenceController | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !options.images?.length) return;
    controllerRef.current = createImageSequence(el, optsRef.current);
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [options.images?.join(',')]);

  return controllerRef.current;
}

/**
 * Hook: timeline with steps. Returns controller.
 */
export function useTimeline(
  steps: TimelineStep[],
  options: TimelineOptions = {}
): TimelineController | null {
  const controllerRef = useRef<TimelineController | null>(null);
  useEffect(() => {
    controllerRef.current = createTimeline(steps, options);
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);
  return controllerRef.current;
}

/**
 * Hook: bind text writer to an element ref. Returns the controller (write, queue, add, remove, etc.).
 * Cleans up on unmount.
 */
export function useTextWriter<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: TextWriterOptions = {}
): RefObject<TextWriterController | null> {
  const controllerRef = useRef<TextWriterController | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      return;
    }
    const controller = createTextWriter(el, optsRef.current);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  return controllerRef;
}
