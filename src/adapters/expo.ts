/**
 * Expo adapter (React Native friendly, no DOM assumptions).
 * Provides state-based flicker and image-sequence controllers and React hooks.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlickerOptions, ImageSequenceOptions } from '../types.js';
import { DEFAULT_FLICKER_OPTIONS, DEFAULT_IMAGE_SEQUENCE_OPTIONS } from '../types.js';
import { schedule } from '../engine.js';

export interface ExpoFlickerState {
  opacity: number;
  visible: boolean;
}

export interface ExpoFlickerController {
  start(): void;
  stop(): void;
  destroy(): void;
  setOptions(options: Partial<FlickerOptions>): void;
  subscribe(listener: (state: ExpoFlickerState) => void): () => void;
  getState(): ExpoFlickerState;
  readonly isRunning: boolean;
}

function getNextInterval(opts: FlickerOptions): number {
  if (opts.randomInterval && opts.minInterval != null && opts.maxInterval != null) {
    return opts.minInterval + Math.random() * (opts.maxInterval - opts.minInterval);
  }
  return opts.interval ?? DEFAULT_FLICKER_OPTIONS.interval;
}

/**
 * Create an Expo-friendly flicker controller.
 * Emits state updates (opacity/visible) you can bind to RN Animated/View styles.
 */
export function createExpoFlicker(options: FlickerOptions = {}): ExpoFlickerController {
  let opts: FlickerOptions = { ...DEFAULT_FLICKER_OPTIONS, ...options };
  let running = false;
  let cancelCurrent: (() => void) | null = null;
  let state: ExpoFlickerState = { opacity: 1, visible: true };
  const listeners = new Set<(next: ExpoFlickerState) => void>();
  let destroyed = false;
  let startTime = 0;

  function emit(next: ExpoFlickerState): void {
    state = next;
    for (const l of listeners) l(state);
  }

  function tick(): void {
    if (!running || destroyed) return;
    const nextVisible = !state.visible;
    const offOpacity = opts.offOpacity ?? 0;
    emit({
      visible: nextVisible,
      opacity: nextVisible ? 1 : offOpacity,
    });

    if (opts.duration != null && Date.now() - startTime >= opts.duration) {
      running = false;
      cancelCurrent = null;
      emit({ visible: true, opacity: 1 });
      opts.onStop?.();
      return;
    }

    const nextMs = getNextInterval(opts);
    cancelCurrent = schedule(tick, nextMs, { engine: opts.engine ?? 'timeout' });
    opts.onTick?.(nextVisible);
  }

  const controller: ExpoFlickerController = {
    get isRunning() {
      return running;
    },
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (running || destroyed) return;
      running = true;
      startTime = Date.now();
      emit({ visible: true, opacity: 1 });
      opts.onStart?.();
      const nextMs = getNextInterval(opts);
      cancelCurrent = schedule(tick, nextMs, { engine: opts.engine ?? 'timeout' });
    },
    stop() {
      if (!running) return;
      running = false;
      cancelCurrent?.();
      cancelCurrent = null;
      emit({ visible: true, opacity: 1 });
      opts.onStop?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.stop();
      listeners.clear();
      opts.onDestroy?.();
    },
    setOptions(next) {
      opts = { ...opts, ...next };
    },
  };

  return controller;
}

export interface ExpoImageSequenceState {
  currentIndex: number;
  currentImage: string | null;
}

export interface ExpoImageSequenceController {
  start(): void;
  stop(): void;
  destroy(): void;
  next(): void;
  previous(): void;
  jumpTo(index: number): void;
  setOptions(options: Partial<ImageSequenceOptions>): void;
  subscribe(listener: (state: ExpoImageSequenceState) => void): () => void;
  getState(): ExpoImageSequenceState;
  readonly isRunning: boolean;
}

function getNextSequenceInterval(opts: ImageSequenceOptions): number {
  if (opts.randomInterval && opts.minInterval != null && opts.maxInterval != null) {
    return opts.minInterval + Math.random() * (opts.maxInterval - opts.minInterval);
  }
  return opts.interval ?? DEFAULT_IMAGE_SEQUENCE_OPTIONS.interval;
}

/**
 * Create Expo-friendly image sequence controller (URI/index state updates).
 */
export function createExpoImageSequence(options: ImageSequenceOptions): ExpoImageSequenceController {
  if (!options.images || options.images.length === 0) {
    throw new Error('ImageSequenceOptions.images must contain at least one image URL');
  }
  let opts: ImageSequenceOptions = { ...DEFAULT_IMAGE_SEQUENCE_OPTIONS, ...options };
  let running = false;
  let cancelCurrent: (() => void) | null = null;
  let destroyed = false;
  let startTime = 0;
  let currentIndex = Math.min(Math.max(opts.startIndex ?? 0, 0), opts.images.length - 1);
  let state: ExpoImageSequenceState = {
    currentIndex,
    currentImage: opts.images[currentIndex] ?? null,
  };
  const listeners = new Set<(next: ExpoImageSequenceState) => void>();

  function emit(index: number): void {
    currentIndex = index;
    state = {
      currentIndex,
      currentImage: opts.images[currentIndex] ?? null,
    };
    for (const l of listeners) l(state);
    if (state.currentImage != null) {
      opts.onChange?.(state.currentIndex, opts.images.length, state.currentImage);
    }
  }

  function tick(): void {
    if (!running || destroyed) return;
    const direction = opts.direction ?? 1;
    let nextIndex = currentIndex + direction;
    if (nextIndex >= opts.images.length) {
      if (opts.loop) {
        nextIndex = 0;
        opts.onLoop?.();
      } else {
        running = false;
        opts.onComplete?.();
        opts.onStop?.();
        return;
      }
    } else if (nextIndex < 0) {
      if (opts.loop) {
        nextIndex = opts.images.length - 1;
        opts.onLoop?.();
      } else {
        running = false;
        opts.onComplete?.();
        opts.onStop?.();
        return;
      }
    }
    emit(nextIndex);

    if (opts.duration != null && Date.now() - startTime >= opts.duration) {
      running = false;
      opts.onStop?.();
      return;
    }
    const nextMs = getNextSequenceInterval(opts);
    cancelCurrent = schedule(tick, nextMs, { engine: opts.engine ?? 'timeout' });
  }

  const controller: ExpoImageSequenceController = {
    get isRunning() {
      return running;
    },
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start() {
      if (running || destroyed) return;
      running = true;
      startTime = Date.now();
      opts.onStart?.();
      const nextMs = getNextSequenceInterval(opts);
      cancelCurrent = schedule(tick, nextMs, { engine: opts.engine ?? 'timeout' });
    },
    stop() {
      if (!running) return;
      running = false;
      cancelCurrent?.();
      cancelCurrent = null;
      opts.onStop?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.stop();
      listeners.clear();
      opts.onDestroy?.();
    },
    next() {
      const atEnd = currentIndex >= opts.images.length - 1;
      if (atEnd && !opts.loop) return;
      emit(atEnd ? 0 : currentIndex + 1);
    },
    previous() {
      const atStart = currentIndex <= 0;
      if (atStart && !opts.loop) return;
      emit(atStart ? opts.images.length - 1 : currentIndex - 1);
    },
    jumpTo(index: number) {
      if (index < 0 || index >= opts.images.length) return;
      emit(index);
    },
    setOptions(next) {
      if (next.images && next.images.length === 0) {
        throw new Error('ImageSequenceOptions.images must contain at least one image URL');
      }
      opts = { ...opts, ...next };
      if (next.images) {
        if (currentIndex >= opts.images.length) {
          emit(opts.images.length - 1);
        } else {
          emit(currentIndex);
        }
      }
    },
  };

  return controller;
}

export interface UseExpoFlickerResult {
  opacity: number;
  visible: boolean;
  controller: ExpoFlickerController;
}

/**
 * React hook for Expo flicker state.
 */
export function useExpoFlicker(options: FlickerOptions = {}): UseExpoFlickerResult {
  const controllerRef = useRef<ExpoFlickerController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createExpoFlicker(options);
  }
  const [state, setState] = useState<ExpoFlickerState>(controllerRef.current.getState());

  useEffect(() => {
    const c = controllerRef.current!;
    const unsubscribe = c.subscribe(setState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    controllerRef.current?.setOptions(options);
  }, [options]);

  const controller = useMemo(() => controllerRef.current!, []);
  return { ...state, controller };
}

export interface UseExpoImageSequenceResult {
  currentIndex: number;
  currentImage: string | null;
  controller: ExpoImageSequenceController;
}

/**
 * React hook for Expo image sequence state.
 */
export function useExpoImageSequence(options: ImageSequenceOptions): UseExpoImageSequenceResult {
  const controllerRef = useRef<ExpoImageSequenceController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createExpoImageSequence(options);
  }
  const [state, setState] = useState<ExpoImageSequenceState>(controllerRef.current.getState());

  useEffect(() => {
    const c = controllerRef.current!;
    const unsubscribe = c.subscribe(setState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    controllerRef.current?.setOptions(options);
  }, [options]);

  const controller = useMemo(() => controllerRef.current!, []);
  return { ...state, controller };
}
