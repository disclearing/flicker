/**
 * Timeline / keyframe system: run sequences of steps (e.g. flicker fast -> pause -> crossfade -> glitch).
 */

import type { FlickerController, FlickerOptions, ImageSequenceController } from './types.js';
import { createFlicker } from './flicker.js';

export type TimelineStep =
  | { type: 'flicker'; element: HTMLElement | HTMLImageElement; options: FlickerOptions; duration: number }
  | { type: 'pause'; duration: number }
  | { type: 'callback'; fn: () => void | Promise<void> }
  | { type: 'sequence'; controller: ImageSequenceController; duration?: number }
  | { type: 'custom'; run: () => Promise<void> };

export interface TimelineOptions {
  /** Run steps in order; if loop, restart from step 0 after last. */
  loop?: boolean;
  /** Callback when timeline completes (all steps done, or stopped). */
  onComplete?: () => void;
  /** Callback when a step starts. */
  onStepStart?: (index: number, step: TimelineStep) => void;
  /** Callback when a step ends. */
  onStepEnd?: (index: number) => void;
}

/** Controller for a timeline. */
export interface TimelineController {
  start(): void;
  stop(): void;
  destroy(): void;
  readonly isRunning: boolean;
  readonly currentStepIndex: number;
}

/**
 * Create a timeline that runs steps in order.
 * Each step can be flicker (with duration), pause, callback, or custom async.
 */
export function createTimeline(steps: TimelineStep[], options: TimelineOptions = {}): TimelineController {
  const opts = { loop: false, ...options };
  let currentStepIndex = 0;
  let running = false;
  let cancelled = false;
  let runToken = 0;
  let flickerController: FlickerController | null = null;
  const activeSequenceControllers = new Set<ImageSequenceController>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function runStep(index: number, token: number): Promise<void> {
    if (token !== runToken || cancelled || !running || index >= steps.length) {
      if (running && index >= steps.length && opts.loop) {
        currentStepIndex = 0;
        void runStep(0, token);
      } else if (index >= steps.length) {
        running = false;
        opts.onComplete?.();
      }
      return;
    }
    const step = steps[index];
    opts.onStepStart?.(index, step);
    currentStepIndex = index;

    if (step.type === 'flicker') {
      flickerController = createFlicker(step.element, step.options);
      flickerController.start();
      await new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (token !== runToken || cancelled || !running) {
            resolve();
            return;
          }
          flickerController?.stop();
          flickerController = null;
          opts.onStepEnd?.(index);
          resolve();
        }, step.duration);
      });
    } else if (step.type === 'pause') {
      await new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (token !== runToken || cancelled || !running) {
            resolve();
            return;
          }
          opts.onStepEnd?.(index);
          resolve();
        }, step.duration);
      });
    } else if (step.type === 'callback') {
      await Promise.resolve(step.fn());
      if (token !== runToken || cancelled || !running) return;
      opts.onStepEnd?.(index);
    } else if (step.type === 'sequence') {
      activeSequenceControllers.add(step.controller);
      step.controller.start();
      const duration = step.duration ?? 0;
      if (duration > 0) {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            timeoutId = null;
            if (token !== runToken || cancelled || !running) {
              resolve();
              return;
            }
            step.controller.stop();
            activeSequenceControllers.delete(step.controller);
            opts.onStepEnd?.(index);
            resolve();
          }, duration);
        });
      } else {
        opts.onStepEnd?.(index);
      }
    } else if (step.type === 'custom') {
      await step.run();
      if (token !== runToken || cancelled || !running) return;
      opts.onStepEnd?.(index);
    }

    if (token !== runToken || cancelled || !running) return;
    void runStep(index + 1, token);
  }

  const controller: TimelineController = {
    get isRunning() {
      return running;
    },
    get currentStepIndex() {
      return currentStepIndex;
    },
    start() {
      if (running) return;
      running = true;
      cancelled = false;
      runToken++;
      void runStep(0, runToken);
    },
    stop() {
      running = false;
      cancelled = true;
      runToken++;
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      flickerController?.stop();
      flickerController = null;
      activeSequenceControllers.forEach((controller) => controller.stop());
      activeSequenceControllers.clear();
      opts.onComplete?.();
    },
    destroy() {
      controller.stop();
      flickerController?.destroy?.();
      flickerController = null;
    },
  };

  return controller;
}
