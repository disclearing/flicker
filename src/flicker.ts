import type { FlickerOptions, FlickerController } from './types.js';
import { DEFAULT_FLICKER_OPTIONS } from './types.js';
import { schedule, prefersReducedMotion, subscribeVisibility } from './engine.js';
import { applyFullFilters } from './effects.js';
import { runEffects } from './plugins.js';

function getNextInterval(opts: FlickerOptions): number {
  if (opts.randomInterval && opts.minInterval != null && opts.maxInterval != null) {
    return opts.minInterval + Math.random() * (opts.maxInterval - opts.minInterval);
  }
  return opts.interval ?? DEFAULT_FLICKER_OPTIONS.interval;
}

function applyVisible(el: HTMLElement | HTMLImageElement, visible: boolean, opts: FlickerOptions): void {
  const mode = opts.mode ?? DEFAULT_FLICKER_OPTIONS.mode;
  const offOpacity = opts.offOpacity ?? DEFAULT_FLICKER_OPTIONS.offOpacity;

  if (mode === 'opacity' || mode === 'both') {
    el.style.opacity = visible ? '1' : String(offOpacity);
  }
  if (mode === 'visibility' || mode === 'both') {
    el.style.visibility = visible ? 'visible' : 'hidden';
  }
  if (opts.filters) {
    if (visible) {
      el.style.filter = '';
    } else {
      applyFullFilters(el, opts.filters);
    }
  }
}

/**
 * Create a flicker controller for a single DOM element (text, image, or any HTMLElement).
 * Toggles visibility/opacity on a timer. Call .start() to begin, .stop() to end.
 */
export function createFlicker(
  element: HTMLElement | HTMLImageElement,
  options: FlickerOptions = {}
): FlickerController {
  let opts: FlickerOptions = { ...DEFAULT_FLICKER_OPTIONS, ...options };
  let cancelSchedule: (() => void) | null = null;
  let visible = true;
  let startTime = 0;
  let running = false;
  let pausedByVisibility = false;
  let destroyed = false;
  let unsubscribeVisibility: (() => void) | null = null;

  const engine = opts.engine ?? 'timeout';
  const respectReducedMotion = opts.respectReducedMotion ?? true;
  const autoPauseOnHidden = opts.autoPauseOnHidden ?? true;
  const reducedMotionActive = respectReducedMotion && prefersReducedMotion();

  const tick = (): void => {
    if (destroyed || !element.isConnected) return;
    if (!running || pausedByVisibility) return;
    if (reducedMotionActive) {
      applyVisible(element, true, opts);
      running = false;
      cancelSchedule?.();
      return;
    }
    visible = !visible;
    applyVisible(element, visible, opts);
    runEffects(element, visible);
    opts.onTick?.(visible);

    const duration = opts.duration;
    if (duration != null && Date.now() - startTime >= duration) {
      running = false;
      cancelSchedule = null;
      applyVisible(element, true, opts);
      opts.onStop?.();
      return;
    }

    const nextMs = getNextInterval(opts);
    cancelSchedule = schedule(tick, nextMs, { engine });
  };

  const controller: FlickerController = {
    get isRunning() {
      return running && !pausedByVisibility;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      cancelSchedule?.();
      cancelSchedule = null;
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      applyVisible(element, true, opts);
      opts.onDestroy?.();
    },
    start() {
      if (destroyed || running) return;
      running = true;
      pausedByVisibility = false;
      startTime = Date.now();
      visible = true;
      applyVisible(element, true, opts);
      opts.onStart?.();
      if (autoPauseOnHidden && typeof document !== 'undefined') {
        unsubscribeVisibility = subscribeVisibility((visibleTab) => {
          opts.onVisibilityChange?.(visibleTab);
          if (visibleTab) {
            if (pausedByVisibility) {
              pausedByVisibility = false;
              opts.onResume?.();
              const nextMs = getNextInterval(opts);
              cancelSchedule = schedule(tick, nextMs, { engine });
            }
          } else {
            if (running && !pausedByVisibility) {
              pausedByVisibility = true;
              cancelSchedule?.();
              cancelSchedule = null;
              opts.onPause?.();
            }
          }
        });
      }
      if (reducedMotionActive) {
        applyVisible(element, true, opts);
        running = false;
        return;
      }
      const nextMs = getNextInterval(opts);
      cancelSchedule = schedule(tick, nextMs, { engine });
    },
    stop() {
      running = false;
      pausedByVisibility = false;
      cancelSchedule?.();
      cancelSchedule = null;
      applyVisible(element, true, opts);
      opts.onStop?.();
    },
    setOptions(newOpts: Partial<FlickerOptions>) {
      opts = { ...opts, ...newOpts };
    },
  };

  return controller;
}

/**
 * Flicker a single element by selector (uses document.querySelector).
 * Returns the controller or null if the element is not found.
 */
export function flickerElement(
  selector: string,
  options: FlickerOptions = {}
): FlickerController | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  return createFlicker(el, options);
}

/**
 * Create flicker controllers for multiple elements.
 */
export function flickerAll(
  elements: NodeListOf<HTMLElement | HTMLImageElement> | Array<HTMLElement | HTMLImageElement>,
  options: FlickerOptions = {}
): FlickerController[] {
  const list = Array.from(elements);
  return list.map((el) => createFlicker(el, options));
}

/**
 * Flicker all elements matching a selector.
 */
export function flickerSelector(selector: string, options: FlickerOptions = {}): FlickerController[] {
  if (typeof document === 'undefined') return [];
  const list = document.querySelectorAll<HTMLElement>(selector);
  return flickerAll(list, options);
}
