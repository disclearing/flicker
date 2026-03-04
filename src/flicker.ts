import type { FlickerOptions, FlickerController } from './types.js';
import { DEFAULT_FLICKER_OPTIONS } from './types.js';

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
}

function scheduleNext(
  run: () => void,
  opts: FlickerOptions,
  startTime: number,
  duration: number | undefined
): ReturnType<typeof setTimeout> {
  const nextMs = getNextInterval(opts);
  return setTimeout(() => {
    if (duration != null && Date.now() - startTime >= duration) {
      run(); // let run() handle stop
      return;
    }
    run();
  }, nextMs);
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = true;
  let startTime = 0;
  let running = false;

  const tick = (): void => {
    if (!running || !element.isConnected) {
      running = false;
      timer = null;
      opts.onStop?.();
      return;
    }
    visible = !visible;
    applyVisible(element, visible, opts);
    opts.onTick?.(visible);

    const duration = opts.duration;
    if (duration != null && Date.now() - startTime >= duration) {
      running = false;
      timer = null;
      applyVisible(element, true, opts);
      opts.onStop?.();
      return;
    }

    timer = scheduleNext(tick, opts, startTime, duration);
  };

  const controller: FlickerController = {
    get isRunning() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      startTime = Date.now();
      visible = true;
      applyVisible(element, true, opts);
      timer = scheduleNext(tick, opts, startTime, opts.duration);
    },
    stop() {
      running = false;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
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
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  return createFlicker(el, options);
}

/**
 * Create flicker controllers for multiple elements (e.g. all images or all nodes with a class).
 * Returns an array of controllers; you must call .start() on each (or iterate) to run.
 */
export function flickerAll(
  elements: NodeListOf<HTMLElement | HTMLImageElement> | Array<HTMLElement | HTMLImageElement>,
  options: FlickerOptions = {}
): FlickerController[] {
  const list = Array.from(elements);
  return list.map((el) => createFlicker(el, options));
}

/**
 * Flicker all elements matching a selector. Returns array of controllers.
 */
export function flickerSelector(selector: string, options: FlickerOptions = {}): FlickerController[] {
  const list = document.querySelectorAll<HTMLElement>(selector);
  return flickerAll(list, options);
}
