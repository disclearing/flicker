/**
 * CSS filter pipeline and text-specific effect modes.
 */

import type { FilterOptions, TextMode, HtmlMode, LetterizeMode } from './types.js';

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

/** Decode HTML entities in a string (e.g. &#60; &amp; to < &). */
export function decodeEntities(str: string): string {
  if (typeof document === 'undefined') {
    return str.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
  }
  const el = document.createElement('div');
  el.innerHTML = str;
  return el.textContent ?? str;
}

/** Get a random character for scramble/glyph substitution. */
export function randomChar(pool: string = GLYPH_POOL): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface GetTextSpansOptions {
  html?: HtmlMode;
  letterize?: LetterizeMode;
  /** When stripping HTML, decode entities in the string. */
  decodeEntitiesIn?: string;
}

/** Wrap text nodes into spans per character. Preserves element structure when html is 'preserve'. */
function getTextSpansInternal(container: HTMLElement, options: GetTextSpansOptions = {}): HTMLSpanElement[] {
  const html = options.html ?? 'preserve';
  const spans: HTMLSpanElement[] = [];

  if (html === 'strip') {
    const raw = options.decodeEntitiesIn != null ? decodeEntities(options.decodeEntitiesIn) : (container.textContent ?? '');
    container.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < raw.length; i++) {
      const span = document.createElement('span');
      span.textContent = raw[i];
      span.setAttribute('data-char-index', String(i));
      span.setAttribute('data-flicker-char-index', String(i));
      spans.push(span);
      frag.appendChild(span);
    }
    container.appendChild(frag);
    return spans;
  }

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        span.setAttribute('data-char-index', String(spans.length));
        span.setAttribute('data-flicker-char-index', String(spans.length));
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

/** Wrap text nodes into spans per character. */
function getTextSpans(container: HTMLElement, options?: GetTextSpansOptions): HTMLSpanElement[] {
  return getTextSpansInternal(container, options ?? {});
}

/**
 * Letterize a string into a document fragment of per-character spans (non-destructive).
 * Use when you want to mount the result yourself (e.g. React/Vue).
 */
export function letterizeToFragment(text: string, options: { decodeEntities?: boolean } = {}): DocumentFragment {
  const decoded = options.decodeEntities !== false ? decodeEntities(text) : text;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < decoded.length; i++) {
    const span = document.createElement('span');
    span.textContent = decoded[i];
    span.setAttribute('data-char-index', String(i));
    span.setAttribute('data-flicker-char-index', String(i));
    frag.appendChild(span);
  }
  return frag;
}

/**
 * Set container content to letterized spans for the given text (decodes entities).
 * Used by the text writer for add() so effects can run with startFromIndex.
 */
export function setLetterizedContent(container: HTMLElement, text: string): void {
  const decoded = decodeEntities(text);
  container.textContent = '';
  for (let i = 0; i < decoded.length; i++) {
    const span = document.createElement('span');
    span.textContent = decoded[i];
    span.setAttribute('data-char-index', String(i));
    span.setAttribute('data-flicker-char-index', String(i));
    container.appendChild(span);
  }
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
export function preparePerCharFlicker(container: HTMLElement, options?: GetTextSpansOptions): HTMLSpanElement[] {
  return getTextSpans(container, options);
}

export interface ScrambleRevealOptions {
  interval?: number;
  glyphPool?: string;
  onComplete?: () => void;
  onStep?: (index: number, char: string, isComplete: boolean) => void;
  html?: HtmlMode;
  decodeEntitiesIn?: string;
  /** When set, use existing spans in container and only reveal from this index (for writer add()). */
  startFromIndex?: number;
}

/**
 * Scramble text then reveal: replace each char with random from pool, then reveal one by one.
 * Returns a function to stop the effect.
 */
export function runScrambleReveal(
  container: HTMLElement,
  options: ScrambleRevealOptions = {}
): () => void {
  const interval = options.interval ?? 80;
  const pool = options.glyphPool ?? GLYPH_POOL;
  const startFromIndex = options.startFromIndex ?? 0;
  const useExistingSpans = startFromIndex > 0;
  const spans = useExistingSpans
    ? (Array.from(container.querySelectorAll<HTMLSpanElement>('span[data-flicker-char-index]'))
        .sort((a, b) => Number(a.getAttribute('data-flicker-char-index')) - Number(b.getAttribute('data-flicker-char-index'))))
    : (options.decodeEntitiesIn != null
        ? getTextSpansInternal(container, { html: 'strip', decodeEntitiesIn: options.decodeEntitiesIn })
        : getTextSpans(container, { html: options.html }));
  if (spans.length === 0 || startFromIndex >= spans.length) return () => {};
  const original: string[] = spans.map((s) => s.textContent ?? '');
  let index = startFromIndex;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  container.setAttribute('data-flicker-state', 'writing');
  container.classList.add('flicker-writing');
  for (let i = startFromIndex; i < spans.length; i++) spans[i].textContent = randomChar(pool);
  const tick = () => {
    if (cancelled || index >= spans.length) {
      container.removeAttribute('data-flicker-state');
      container.classList.remove('flicker-writing');
      options.onStep?.(index, '', true);
      options.onComplete?.();
      return;
    }
    const char = original[index];
    spans[index].textContent = char;
    options.onStep?.(index, char, index === spans.length - 1);
    index++;
    timeoutId = setTimeout(tick, interval);
  };
  timeoutId = setTimeout(tick, interval);
  return () => {
    cancelled = true;
    if (timeoutId != null) clearTimeout(timeoutId);
    container.removeAttribute('data-flicker-state');
    container.classList.remove('flicker-writing');
  };
}

/**
 * Glyph substitution: periodically replace characters with random from pool.
 * Returns stop function.
 */
export function runGlyphSubstitution(
  container: HTMLElement,
  options: { interval?: number; glyphPool?: string; probability?: number; html?: HtmlMode; decodeEntitiesIn?: string }
): () => void {
  const interval = options.interval ?? 200;
  const pool = options.glyphPool ?? GLYPH_POOL;
  const probability = options.probability ?? 0.3;
  const spans = options.decodeEntitiesIn != null
    ? getTextSpansInternal(container, { html: 'strip', decodeEntitiesIn: options.decodeEntitiesIn })
    : getTextSpans(container, { html: options.html });
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

export interface DecodeOptions {
  interval?: number;
  decodeDuration?: number;
  glyphPool?: string;
  onComplete?: () => void;
  onStep?: (index: number, char: string, isComplete: boolean) => void;
  html?: HtmlMode;
  decodeEntitiesIn?: string;
  /** When set, use existing spans and only decode from this index (for writer add()). */
  startFromIndex?: number;
  /** Show typing cursor. true = '|', or pass character. */
  cursor?: boolean | string;
}

/**
 * Decode effect: each character cycles through random glyphs then resolves to final character.
 * Returns stop function.
 */
export function runDecode(
  container: HTMLElement,
  options: DecodeOptions = {}
): () => void {
  const resolveInterval = options.interval ?? 50;
  const decodeDuration = options.decodeDuration ?? 60;
  const pool = options.glyphPool ?? GLYPH_POOL;
  const startFromIndex = options.startFromIndex ?? 0;
  const useExistingSpans = startFromIndex > 0;
  const spans = useExistingSpans
    ? (Array.from(container.querySelectorAll<HTMLSpanElement>('span[data-flicker-char-index]'))
        .sort((a, b) => Number(a.getAttribute('data-flicker-char-index')) - Number(b.getAttribute('data-flicker-char-index'))))
    : (options.decodeEntitiesIn != null
        ? getTextSpansInternal(container, { html: 'strip', decodeEntitiesIn: options.decodeEntitiesIn })
        : getTextSpans(container, { html: options.html }));
  if (spans.length === 0 || startFromIndex >= spans.length) {
    options.onComplete?.();
    return () => {};
  }
  const original: string[] = spans.map((s) => s.textContent ?? '');
  for (let i = startFromIndex; i < spans.length; i++) spans[i].textContent = randomChar(pool);
  const cursorChar = options.cursor === true ? '|' : (typeof options.cursor === 'string' ? options.cursor : '');
  let cursorEl: HTMLSpanElement | null = null;
  if (cursorChar) {
    cursorEl = document.createElement('span');
    cursorEl.className = 'flicker-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.textContent = cursorChar;
  }
  const placeCursor = (afterIndex: number) => {
    if (!cursorEl || !container.contains(cursorEl)) return;
    const next = spans[afterIndex + 1];
    if (next) container.insertBefore(cursorEl, next);
    else container.appendChild(cursorEl);
  };
  const removeCursor = () => {
    cursorEl?.remove();
    cursorEl = null;
  };
  container.setAttribute('data-flicker-state', 'writing');
  container.classList.add('flicker-writing');
  let charIndex = startFromIndex;
  let cancelled = false;
  if (cursorEl && spans.length > 0) placeCursor(startFromIndex - 1);
  const cycleId = setInterval(() => {
    if (cancelled) return;
    spans.forEach((s, i) => {
      if (i < charIndex) s.textContent = original[i];
      else if (i === charIndex) s.textContent = randomChar(pool);
      else s.textContent = randomChar(pool);
    });
    if (cursorEl) placeCursor(charIndex);
  }, decodeDuration);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const resolveNext = () => {
    if (cancelled || charIndex >= spans.length) {
      removeCursor();
      clearInterval(cycleId);
      spans.forEach((s, i) => { s.textContent = original[i]; });
      container.removeAttribute('data-flicker-state');
      container.classList.remove('flicker-writing');
      options.onStep?.(charIndex, '', true);
      options.onComplete?.();
      return;
    }
    spans[charIndex].textContent = original[charIndex];
    if (cursorEl) placeCursor(charIndex);
    const char = original[charIndex];
    const isComplete = charIndex === spans.length - 1;
    options.onStep?.(charIndex, char, isComplete);
    charIndex++;
    timeoutId = setTimeout(resolveNext, resolveInterval);
  };
  timeoutId = setTimeout(resolveNext, decodeDuration * 2);
  return () => {
    cancelled = true;
    removeCursor();
    clearInterval(cycleId);
    if (timeoutId != null) clearTimeout(timeoutId);
    container.removeAttribute('data-flicker-state');
    container.classList.remove('flicker-writing');
    spans.forEach((s, i) => { s.textContent = original[i]; });
  };
}

function isPunctuationOrSpace(ch: string): boolean {
  return /[\s.,!?;:'"()[\]{}]/.test(ch);
}

export interface TypewriterOptions {
  interval?: number;
  minInterval?: number;
  maxInterval?: number;
  humanLike?: boolean;
  pauseOnSpaces?: number;
  punctuationPauseMs?: number;
  onComplete?: () => void;
  onStep?: (index: number, char: string, isComplete: boolean) => void;
  html?: HtmlMode;
  decodeEntitiesIn?: string;
  /** When set, use existing spans and only reveal from this index (for writer add()). */
  startFromIndex?: number;
  /** Show typing cursor. true = '|', or pass character. */
  cursor?: boolean | string;
}

/**
 * Typewriter effect: reveal one character at a time. Optional human-like variance and punctuation pause.
 * Returns stop function.
 */
export function runTypewriter(
  container: HTMLElement,
  options: TypewriterOptions = {}
): () => void {
  const baseInterval = options.interval ?? 100;
  const minInterval = options.minInterval ?? baseInterval * 0.7;
  const maxInterval = options.maxInterval ?? baseInterval * 1.5;
  const humanLike = options.humanLike ?? false;
  const pauseOnSpaces = options.pauseOnSpaces ?? 0;
  const punctuationPauseMs = options.punctuationPauseMs ?? 0;
  const startFromIndex = options.startFromIndex ?? 0;
  const cursorChar = options.cursor === true ? '|' : (typeof options.cursor === 'string' ? options.cursor : '');
  const useExistingSpans = startFromIndex > 0;
  const spans = useExistingSpans
    ? (Array.from(container.querySelectorAll<HTMLSpanElement>('span[data-flicker-char-index]'))
        .sort((a, b) => Number(a.getAttribute('data-flicker-char-index')) - Number(b.getAttribute('data-flicker-char-index'))))
    : (options.decodeEntitiesIn != null
        ? getTextSpansInternal(container, { html: 'strip', decodeEntitiesIn: options.decodeEntitiesIn })
        : getTextSpans(container, { html: options.html }));
  if (spans.length === 0 || startFromIndex >= spans.length) {
    options.onComplete?.();
    return () => {};
  }
  const original: string[] = spans.map((s) => s.textContent ?? '');
  for (let i = startFromIndex; i < spans.length; i++) spans[i].textContent = '';
  let index = startFromIndex;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cursorEl: HTMLSpanElement | null = null;
  if (cursorChar) {
    cursorEl = document.createElement('span');
    cursorEl.className = 'flicker-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.textContent = cursorChar;
  }
  container.setAttribute('data-flicker-state', 'writing');
  container.classList.add('flicker-writing');
  const placeCursor = (afterIndex: number) => {
    if (!cursorEl || !container.contains(cursorEl)) return;
    const next = spans[afterIndex + 1];
    if (next) container.insertBefore(cursorEl, next);
    else container.appendChild(cursorEl);
  };
  const removeCursor = () => {
    cursorEl?.remove();
    cursorEl = null;
  };
  const scheduleNext = () => {
    if (cancelled || index >= spans.length) {
      removeCursor();
      container.removeAttribute('data-flicker-state');
      container.classList.remove('flicker-writing');
      options.onStep?.(index, '', true);
      options.onComplete?.();
      return;
    }
    const char = original[index];
    spans[index].textContent = char;
    if (cursorEl) placeCursor(index);
    const isComplete = index === spans.length - 1;
    options.onStep?.(index, char, isComplete);
    index++;
    let delay = baseInterval;
    if (humanLike && minInterval != null && maxInterval != null) {
      delay = minInterval + Math.random() * (maxInterval - minInterval);
    }
    if (char === ' ' && pauseOnSpaces > 0) delay += pauseOnSpaces;
    if (punctuationPauseMs > 0 && isPunctuationOrSpace(char)) delay += punctuationPauseMs;
    timeoutId = setTimeout(scheduleNext, delay);
  };
  if (cursorEl && spans.length > 0) placeCursor(startFromIndex - 1);
  timeoutId = setTimeout(scheduleNext, baseInterval);
  return () => {
    cancelled = true;
    removeCursor();
    if (timeoutId != null) clearTimeout(timeoutId);
    container.removeAttribute('data-flicker-state');
    container.classList.remove('flicker-writing');
    spans.forEach((s, i) => { s.textContent = original[i]; });
  };
}
