/**
 * Plugin registry for custom transitions and effects.
 * Custom transitions and effects run in try/catch for isolation.
 */

import type { ImageTransition } from './types.js';

export type CustomTransitionFn = (
  element: HTMLImageElement,
  newSrc: string,
  duration: number
) => Promise<void>;

/** Registry of custom transition names to implementations. */
const transitionRegistry = new Map<string, CustomTransitionFn>();

/** Order of registration for deterministic execution. */
const transitionOrder: string[] = [];

/**
 * Register a custom transition by name. Overwrites existing.
 */
export function registerTransition(name: string, fn: CustomTransitionFn): void {
  if (!transitionOrder.includes(name)) {
    transitionOrder.push(name);
  }
  transitionRegistry.set(name, fn);
}

/**
 * Unregister a custom transition.
 */
export function unregisterTransition(name: string): boolean {
  const idx = transitionOrder.indexOf(name);
  if (idx >= 0) transitionOrder.splice(idx, 1);
  return transitionRegistry.delete(name);
}

/**
 * Get a custom transition by name. Returns undefined if not found or built-in.
 */
export function getTransition(name: string): CustomTransitionFn | undefined {
  return transitionRegistry.get(name);
}

/**
 * Check if a transition name is custom (registered).
 */
export function isCustomTransition(name: string): boolean {
  return transitionRegistry.has(name);
}

const BUILTIN_TRANSITIONS: ImageTransition[] = [
  'instant', 'crossfade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom', 'flicker',
];

/**
 * Run transition (built-in or custom) with error boundary.
 */
export async function runTransition(
  element: HTMLImageElement,
  newSrc: string,
  transition: string,
  duration: number
): Promise<void> {
  const custom = getTransition(transition);
  if (custom) {
    try {
      await custom(element, newSrc, duration);
    } catch (err) {
      console.warn('[flicker] Custom transition failed, falling back to instant:', err);
      element.src = newSrc;
    }
    return;
  }
  if (BUILTIN_TRANSITIONS.includes(transition as ImageTransition)) {
    return runBuiltinTransition(element, newSrc, transition as ImageTransition, duration);
  }
  element.src = newSrc;
}

/** Built-in transition runner (same logic as in image-sequence, extracted for use by runTransition). */
function runBuiltinTransition(
  imgElement: HTMLImageElement,
  newSrc: string,
  transition: ImageTransition,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    const parent = imgElement.parentElement;
    if (!parent) {
      imgElement.src = newSrc;
      resolve();
      return;
    }
    switch (transition) {
      case 'instant':
        imgElement.src = newSrc;
        resolve();
        break;
      case 'crossfade': {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;display:inline-block;';
        const newImg = document.createElement('img');
        newImg.src = newSrc;
        newImg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity ${duration}ms;`;
        newImg.style.objectFit = imgElement.style.objectFit || 'cover';
        parent.insertBefore(wrapper, imgElement);
        wrapper.appendChild(imgElement);
        wrapper.appendChild(newImg);
        void newImg.offsetWidth;
        newImg.style.opacity = '1';
        setTimeout(() => {
          imgElement.src = newSrc;
          imgElement.style.opacity = '1';
          newImg.remove();
          if (wrapper.parentElement) {
            wrapper.parentElement.insertBefore(imgElement, wrapper);
            wrapper.remove();
          }
          resolve();
        }, duration);
        break;
      }
      case 'slide-left':
      case 'slide-right':
      case 'slide-up':
      case 'slide-down': {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;display:inline-block;overflow:hidden;';
        const newImg = document.createElement('img');
        newImg.src = newSrc;
        const transforms: Record<string, string> = {
          'slide-left': 'translateX(100%)',
          'slide-right': 'translateX(-100%)',
          'slide-up': 'translateY(100%)',
          'slide-down': 'translateY(-100%)',
        };
        const ends: Record<string, string> = {
          'slide-left': 'translateX(0)',
          'slide-right': 'translateX(0)',
          'slide-up': 'translateY(0)',
          'slide-down': 'translateY(0)',
        };
        newImg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;transform:${transforms[transition]};transition:transform ${duration}ms ease-out;`;
        newImg.style.objectFit = imgElement.style.objectFit || 'cover';
        parent.insertBefore(wrapper, imgElement);
        wrapper.appendChild(imgElement);
        wrapper.appendChild(newImg);
        void newImg.offsetWidth;
        newImg.style.transform = ends[transition];
        setTimeout(() => {
          imgElement.src = newSrc;
          imgElement.style.transform = '';
          newImg.remove();
          if (wrapper.parentElement) {
            wrapper.parentElement.insertBefore(imgElement, wrapper);
            wrapper.remove();
          }
          resolve();
        }, duration);
        break;
      }
      case 'zoom': {
        imgElement.style.transition = `transform ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`;
        imgElement.style.transform = 'scale(0.8)';
        imgElement.style.opacity = '0.5';
        setTimeout(() => {
          imgElement.src = newSrc;
          void imgElement.offsetWidth;
          imgElement.style.transform = 'scale(1)';
          imgElement.style.opacity = '1';
          setTimeout(() => {
            imgElement.style.transition = '';
            resolve();
          }, duration);
        }, duration / 2);
        break;
      }
      case 'flicker': {
        const flickerCount = Math.floor(duration / 50);
        let count = 0;
        const flick = () => {
          imgElement.style.opacity = imgElement.style.opacity === '0' ? '1' : '0';
          count++;
          if (count >= flickerCount) {
            imgElement.src = newSrc;
            imgElement.style.opacity = '1';
            resolve();
          } else {
            setTimeout(flick, 50);
          }
        };
        flick();
        break;
      }
      default:
        imgElement.src = newSrc;
        resolve();
    }
  });
}

/** Effect fn: applied during flicker "tick" (element, visible). */
export type FlickerEffectFn = (element: HTMLElement | HTMLImageElement, visible: boolean) => void;

const effectRegistry = new Map<string, FlickerEffectFn>();
const effectOrder: string[] = [];

/**
 * Register a custom effect by name. Runs each tick (visible true/false).
 */
export function registerEffect(name: string, fn: FlickerEffectFn): void {
  if (!effectOrder.includes(name)) effectOrder.push(name);
  effectRegistry.set(name, fn);
}

export function unregisterEffect(name: string): boolean {
  const idx = effectOrder.indexOf(name);
  if (idx >= 0) effectOrder.splice(idx, 1);
  return effectRegistry.delete(name);
}

export function getEffect(name: string): FlickerEffectFn | undefined {
  return effectRegistry.get(name);
}

/**
 * Run all registered effects in order with error boundary.
 */
export function runEffects(element: HTMLElement | HTMLImageElement, visible: boolean): void {
  for (const name of effectOrder) {
    const fn = effectRegistry.get(name);
    if (fn) {
      try {
        fn(element, visible);
      } catch (err) {
        console.warn(`[flicker] Effect "${name}" failed:`, err);
      }
    }
  }
}
