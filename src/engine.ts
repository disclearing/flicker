/**
 * Unified scheduler abstraction: setTimeout or requestAnimationFrame.
 * Supports cancel and run tokens for lifecycle safety.
 */

import type { TimingEngine } from './types.js';

export interface ScheduleOptions {
  engine?: TimingEngine;
  /** Base delay in ms. For RAF, used to throttle frame calls. */
  delayMs?: number;
}

/**
 * Schedule a single run after delay. Returns a cancel function.
 */
export function schedule(
  fn: () => void,
  delayMs: number,
  options: ScheduleOptions = {}
): () => void {
  const engine = options.engine ?? 'timeout';

  if (engine === 'raf') {
    let rafId: number | null = null;
    let start: number | null = null;
    let cancelled = false;
    const run = (timestamp: number) => {
      if (cancelled) return;
      if (start == null) start = timestamp;
      const elapsed = timestamp - start;
      if (elapsed >= delayMs) {
        fn();
        return;
      }
      rafId = requestAnimationFrame(run);
    };
    rafId = requestAnimationFrame(run);
    return () => {
      cancelled = true;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }

  const id = setTimeout(fn, delayMs);
  return () => clearTimeout(id);
}

/**
 * Schedule repeated runs. Each run is scheduled after the previous delay.
 * Returns a cancel function.
 */
export function scheduleRepeating(
  fn: () => void,
  getDelayMs: () => number,
  options: ScheduleOptions = {}
): () => void {
  let cancelled = false;
  let cancelCurrent: (() => void) | null = null;

  const run = () => {
    if (cancelled) return;
    fn();
    if (cancelled) return;
    const next = getDelayMs();
    cancelCurrent = schedule(run, next, options);
  };

  const firstDelay = getDelayMs();
  cancelCurrent = schedule(run, firstDelay, options);

  return () => {
    cancelled = true;
    cancelCurrent?.();
  };
}

/**
 * Check if reduced motion is preferred (SSR-safe).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Subscribe to document visibility changes (SSR-safe).
 * Returns unsubscribe function.
 */
export function subscribeVisibility(callback: (visible: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => callback(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
