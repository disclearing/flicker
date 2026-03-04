/**
 * CSS filter pipeline and text-specific effect modes.
 */

import type { FilterOptions, TextMode } from './types.js';

/** Build CSS filter string from FilterOptions. */
export function buildFilterString(filters: FilterOptions): string {
  const parts: string[] = [];
  if (filters.blur != null && filters.blur > 0) {
    parts.push(`blur(${filters.blur}px)`);
  }
  if (filters.contrast != null && filters.contrast !== 1) {
    parts.push(`contrast(${filters.contrast})`);
  }
  if (filters.hueRotate != null && filters.hueRotate !== 0) {
    parts.push(`hue-rotate(${filters.hueRotate}deg)`);
  }
  if (filters.saturate != null && filters.saturate !== 1) {
    parts.push(`saturate(${filters.saturate})`);
  }
  return parts.join(' ');
}

/** Apply filter options to an element's style. */
export function applyFilters(element: HTMLElement | HTMLImageElement, filters: FilterOptions): void {
  const filterStr = buildFilterString(filters);
  if (filterStr) {
    element.style.filter = filterStr;
  }
}

/** Apply chromatic aberration via filter drop-shadow (red/cyan offset). */
export function applyChromaticAberration(element: HTMLElement | HTMLImageElement, amountPx: number): void {
  if (amountPx <= 0) return;
  const a = Math.min(5, Math.max(0.5, amountPx));
  const current = element.style.filter || '';
  element.style.filter = current ? `${current} drop-shadow(${a}px 0 0 rgba(255,0,0,0.6)) drop-shadow(${-a}px 0 0 rgba(0,255,255,0.6))` : `drop-shadow(${a}px 0 0 rgba(255,0,0,0.6)) drop-shadow(${-a}px 0 0 rgba(0,255,255,0.6))`;
}

/** Apply full filter options including chromatic aberration and RGB split approximation (extra drop-shadows). */
export function applyFullFilters(element: HTMLElement | HTMLImageElement, filters: FilterOptions): void {
  let str = buildFilterString(filters);
  if (filters.chromaticAberration != null && filters.chromaticAberration > 0) {
    const a = Math.min(5, Math.max(0.5, filters.chromaticAberration));
    str += ` drop-shadow(${a}px 0 0 rgba(255,0,0,0.5)) drop-shadow(${-a}px 0 0 rgba(0,255,255,0.5))`;
  }
  if (filters.rgbSplit != null) {
    const [rX, rY, gX, gY, bX, bY] = filters.rgbSplit;
    str += ` drop-shadow(${rX}px ${rY}px 0 rgba(255,0,0,0.4)) drop-shadow(${gX}px ${gY}px 0 rgba(0,255,0,0.4)) drop-shadow(${bX}px ${bY}px 0 rgba(0,0,255,0.4))`;
  }
  if (str) element.style.filter = str;
}

const GLYPH_POOL = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

/** Get a random character for scramble/glyph substitution. */
function randomChar(pool: string = GLYPH_POOL): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Wrap text nodes into spans per character. */
function getTextSpans(container: HTMLElement): HTMLSpanElement[] {
  const spans: HTMLSpanElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        span.setAttribute('data-char-index', String(spans.length));
        spans.push(span);
        frag.appendChild(span);
      }
      node.parentNode?.replaceChild(frag, node);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const childList = Array.from(node.childNodes);
      childList.forEach(walk);
    }
  };
  walk(container);
  return spans;
}

export interface TextEffectOptions {
  mode: TextMode;
  /** Character pool for scramble/glyph-sub. Default: GLYPH_POOL */
  glyphPool?: string;
  /** Interval per character for typewriter (ms). */
  typewriterInterval?: number;
  /** Interval for scramble reveal (ms). */
  scrambleInterval?: number;
}

/**
 * Apply per-character flicker by wrapping text in spans.
 * Caller can then run flicker on each span or the container.
 */
export function preparePerCharFlicker(container: HTMLElement): HTMLSpanElement[] {
  return getTextSpans(container);
}

/**
 * Scramble text then reveal: replace each char with random from pool, then reveal one by one.
 * Returns a function to stop the effect.
 */
export function runScrambleReveal(
  container: HTMLElement,
  options: { interval?: number; glyphPool?: string; onComplete?: () => void }
): () => void {
  const interval = options.interval ?? 80;
  const pool = options.glyphPool ?? GLYPH_POOL;
  const spans = getTextSpans(container);
  if (spans.length === 0) return () => {};
  const original: string[] = spans.map((s) => s.textContent ?? '');
  let index = 0;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const tick = () => {
    if (cancelled || index >= spans.length) {
      options.onComplete?.();
      return;
    }
    spans[index].textContent = original[index];
    index++;
    timeoutId = setTimeout(tick, interval);
  };
  spans.forEach((s, i) => {
    s.textContent = randomChar(pool);
  });
  timeoutId = setTimeout(tick, interval);
  return () => {
    cancelled = true;
    if (timeoutId != null) clearTimeout(timeoutId);
  };
}

/**
 * Glyph substitution: periodically replace characters with random from pool.
 * Returns stop function.
 */
export function runGlyphSubstitution(
  container: HTMLElement,
  options: { interval?: number; glyphPool?: string; probability?: number }
): () => void {
  const interval = options.interval ?? 200;
  const pool = options.glyphPool ?? GLYPH_POOL;
  const probability = options.probability ?? 0.3;
  const spans = getTextSpans(container);
  if (spans.length === 0) return () => {};
  const original: string[] = spans.map((s) => s.textContent ?? '');
  let cancelled = false;
  const id = setInterval(() => {
    if (cancelled) return;
    spans.forEach((s, i) => {
      if (Math.random() < probability) s.textContent = randomChar(pool);
      else s.textContent = original[i];
    });
  }, interval);
  return () => {
    cancelled = true;
    clearInterval(id);
    spans.forEach((s, i) => { s.textContent = original[i]; });
  };
}

/**
 * Typewriter effect: reveal one character at a time. Optional flicker on current char.
 * Returns stop function.
 */
export function runTypewriter(
  container: HTMLElement,
  options: { interval?: number; onComplete?: () => void }
): () => void {
  const interval = options.interval ?? 100;
  const spans = getTextSpans(container);
  if (spans.length === 0) {
    options.onComplete?.();
    return () => {};
  }
  const original: string[] = spans.map((s) => s.textContent ?? '');
  spans.forEach((s) => { s.textContent = ''; });
  let index = 0;
  let cancelled = false;
  const id = setInterval(() => {
    if (cancelled || index >= spans.length) {
      clearInterval(id);
      options.onComplete?.();
      return;
    }
    spans[index].textContent = original[index];
    index++;
  }, interval);
  return () => {
    cancelled = true;
    clearInterval(id);
    spans.forEach((s, i) => { s.textContent = original[i]; });
  };
}
