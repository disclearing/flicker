/**
 * Unified text writer: write, queue, add, remove with scramble/typewriter/decode effects.
 * Uses engine, respectReducedMotion, and autoPauseOnHidden like other flicker controllers.
 */

import type { TextWriterOptions, TextWriterController, TextWriterEventName, WriterMode } from './types.js';
import { decodeEntities, createSeededRandom, setLetterizedContent, setLetterizedContentFromHtml } from './effects.js';
import { runScrambleReveal } from './effects.js';
import { runTypewriter } from './effects.js';
import { runDecode } from './effects.js';
import { runGlyphSubstitution } from './effects.js';
import { prefersReducedMotion, subscribeVisibility } from './engine.js';
import { validateOrThrow, validateTextWriterOptions } from './validation.js';

const FLICKER_WRITER_FINISHED = 'flicker-writer-finished';

const DEFAULT_GLYPH_POOL = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

function runWriterEffect(
  element: HTMLElement,
  mode: WriterMode,
  opts: TextWriterOptions,
  decodeEntitiesIn: string,
  startFromIndex: number,
  useHtmlContent: boolean,
  onComplete: () => void
): () => void {
  const interval = opts.interval ?? 80;
  const pool = opts.glyphPool ?? DEFAULT_GLYPH_POOL;
  const humanLike = opts.humanLike ?? false;
  const minInterval = opts.minInterval ?? interval * 0.7;
  const maxInterval = opts.maxInterval ?? interval * 1.5;
  const reduced = (opts.respectReducedMotion !== false) && prefersReducedMotion();
  const random = opts.seed != null ? createSeededRandom(opts.seed) : undefined;

  const cursorOpt = opts.cursor;
  const stepCb = (index: number, char: string, isComplete: boolean) => {
    opts.onStep?.(index, char, isComplete);
  };

  if (reduced) {
    if (useHtmlContent) setLetterizedContentFromHtml(element, decodeEntitiesIn);
    else setLetterizedContent(element, decodeEntitiesIn);
    for (let i = 0; i <= decodeEntitiesIn.length; i++) opts.onStep?.(i, i < decodeEntitiesIn.length ? decodeEntitiesIn[i]! : '', i === decodeEntitiesIn.length);
    onComplete();
    return () => {};
  }

  const effectOpts = {
    random,
    onComplete,
    onStep: stepCb,
    cursor: cursorOpt,
  };

  if (mode === 'scramble') {
    return runScrambleReveal(element, {
      ...effectOpts,
      interval,
      glyphPool: pool,
      decodeEntitiesIn: !useHtmlContent && startFromIndex === 0 ? decodeEntitiesIn : undefined,
      startFromIndex: startFromIndex > 0 ? startFromIndex : undefined,
      existingLetterized: useHtmlContent,
    });
  }
  if (mode === 'typewriter') {
    return runTypewriter(element, {
      ...effectOpts,
      interval,
      minInterval: humanLike ? minInterval : undefined,
      maxInterval: humanLike ? maxInterval : undefined,
      humanLike,
      pauseOnSpaces: opts.pauseOnSpaces,
      punctuationPauseMs: opts.punctuationPauseMs,
      decodeEntitiesIn: !useHtmlContent && startFromIndex === 0 ? decodeEntitiesIn : undefined,
      startFromIndex: startFromIndex > 0 ? startFromIndex : undefined,
      existingLetterized: useHtmlContent,
    });
  }
  if (mode === 'decode') {
    return runDecode(element, {
      ...effectOpts,
      interval,
      decodeDuration: opts.decodeDuration ?? 60,
      glyphPool: pool,
      decodeEntitiesIn: !useHtmlContent && startFromIndex === 0 ? decodeEntitiesIn : undefined,
      startFromIndex: startFromIndex > 0 ? startFromIndex : undefined,
      existingLetterized: useHtmlContent,
    });
  }
  // glyph-sub: continuous substitution; run for a duration then call onComplete
  const stopGlyph = runGlyphSubstitution(element, {
    interval: opts.interval ?? 200,
    glyphPool: pool,
    probability: 0.3,
    decodeEntitiesIn,
    random,
  });
  const t = setTimeout(() => {
    stopGlyph();
    onComplete();
  }, Math.max(100, (decodeEntitiesIn.length - startFromIndex) * (opts.interval ?? 80)));
  return () => {
    clearTimeout(t);
    stopGlyph();
  };
}

/**
 * Create a unified text writer controller: write(), queue(), add(), remove(), with pause/resume and a11y.
 */
export function createTextWriter(element: HTMLElement, options: TextWriterOptions = {}): TextWriterController {
  validateOrThrow(options as Record<string, unknown>, validateTextWriterOptions, 'TextWriter');
  let opts: TextWriterOptions = { ...options };
  let fullText = '';
  let currentLength = 0;
  let cancelCurrent: (() => void) | null = null;
  let running = false;
  let paused = false;
  let pausedByVisibility = false;
  let destroyed = false;
  let phraseQueue: string[] = [];
  let originalPhrases: string[] = [];
  let queueIntervalBetween = 0;
  let queueLoop = false;
  let unsubscribeVisibility: (() => void) | null = null;
  const autoPauseOnHidden = opts.autoPauseOnHidden ?? true;
  const listeners: Record<TextWriterEventName, Array<(...args: unknown[]) => void>> = {
    start: [],
    step: [],
    complete: [],
    destroy: [],
    visibilitychange: [],
  };

  const fire = (event: TextWriterEventName, ...args: unknown[]) => {
    listeners[event].forEach((fn) => { try { fn(...args); } catch (_) { /* ignore */ } });
  };

  const playNextInQueue = () => {
    if (phraseQueue.length === 0) {
      if (queueLoop && originalPhrases.length > 0) phraseQueue = [...originalPhrases];
      else {
        running = false;
        return;
      }
    }
    const text = phraseQueue.shift()!;
    const decoded = typeof text === 'string' ? decodeEntities(text) : text;
    fullText = decoded;
    currentLength = 0;
    cancelCurrent?.();
    startCurrentEffect(decoded, 0, () => {
      currentLength = decoded.length;
      opts.onComplete?.();
      fire('complete');
      if (typeof element.dispatchEvent === 'function') {
        element.dispatchEvent(new CustomEvent(FLICKER_WRITER_FINISHED, { detail: { text: fullText, length: currentLength } }));
      }
      if (queueIntervalBetween > 0) {
        const id = setTimeout(playNextInQueue, queueIntervalBetween);
        cancelCurrent = () => clearTimeout(id);
      } else {
        playNextInQueue();
      }
    });
  };

  const startCurrentEffect = (text: string, fromIndex: number, onComplete: () => void) => {
    const useHtmlContent = fromIndex === 0 && opts.html === 'preserve' && text.includes('<');
    if (useHtmlContent) setLetterizedContentFromHtml(element, text);
    else if (fromIndex > 0) setLetterizedContent(element, text);
    cancelCurrent?.();
    const mergedOpts: TextWriterOptions = {
      ...opts,
      onStep: (index, char, isComplete) => {
        fire('step', index, char, isComplete);
        opts.onStep?.(index, char, isComplete);
      },
    };
    cancelCurrent = runWriterEffect(
      element,
      opts.mode ?? 'scramble',
      mergedOpts,
      text,
      fromIndex,
      useHtmlContent,
      onComplete
    );
  };

  const controller: TextWriterController = {
    get isRunning() {
      return running && !paused && !pausedByVisibility;
    },
    get isPaused() {
      return paused || pausedByVisibility;
    },
    get currentLength() {
      return currentLength;
    },
    write(text: string) {
      if (destroyed) return;
      phraseQueue = [];
      originalPhrases = [];
      const decoded = decodeEntities(text);
      fullText = decoded;
      currentLength = 0;
      opts.onStart?.();
      fire('start');
      running = true;
      if (paused || pausedByVisibility) return;
      cancelCurrent?.();
      startCurrentEffect(decoded, 0, () => {
        currentLength = decoded.length;
        opts.onComplete?.();
        fire('complete');
        if (typeof element.dispatchEvent === 'function') {
          element.dispatchEvent(new CustomEvent(FLICKER_WRITER_FINISHED, { detail: { text: fullText, length: currentLength } }));
        }
        running = false;
      });
    },
    writeAsync(text: string): Promise<void> {
      return new Promise((resolve) => {
        const onDone = () => {
          resolve();
          this.off('complete', onDone);
        };
        this.on('complete', onDone);
        this.write(text);
      });
    },
    queue(phrases: string[], intervalBetween = 0, loop = false) {
      if (destroyed) return;
      originalPhrases = phrases.map((p) => decodeEntities(p));
      phraseQueue = [...originalPhrases];
      queueIntervalBetween = intervalBetween;
      queueLoop = loop;
      opts.onStart?.();
      fire('start');
      running = true;
      if (paused || pausedByVisibility) return;
      playNextInQueue();
    },
    endless(phrases: string[], intervalBetween = 0) {
      this.queue(phrases, intervalBetween, true);
    },
    add(text: string) {
      if (destroyed) return;
      const appended = decodeEntities(text);
      fullText += appended;
      const from = currentLength;
      setLetterizedContent(element, fullText);
      cancelCurrent?.();
      startCurrentEffect(fullText, from, () => {
        currentLength = fullText.length;
        opts.onComplete?.();
        fire('complete');
        if (typeof element.dispatchEvent === 'function') {
          element.dispatchEvent(new CustomEvent(FLICKER_WRITER_FINISHED, { detail: { text: fullText, length: currentLength } }));
        }
      });
    },
    on(event: TextWriterEventName, fn: (...args: unknown[]) => void) {
      listeners[event].push(fn);
    },
    off(event: TextWriterEventName, fn: (...args: unknown[]) => void) {
      const list = listeners[event];
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    },
    remove(n: number) {
      if (destroyed || n <= 0) return;
      fullText = fullText.slice(0, -n);
      currentLength = fullText.length;
      setLetterizedContent(element, fullText);
    },
    start() {
      if (destroyed) return;
      paused = false;
      pausedByVisibility = false;
      if (phraseQueue.length > 0) {
        running = true;
        playNextInQueue();
      }
    },
    stop() {
      cancelCurrent?.();
      cancelCurrent = null;
      running = false;
      phraseQueue = [];
    },
    pause() {
      paused = true;
      cancelCurrent?.();
      cancelCurrent = null;
    },
    resume() {
      paused = false;
      if (phraseQueue.length > 0 && !pausedByVisibility) playNextInQueue();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelCurrent?.();
      cancelCurrent = null;
      running = false;
      paused = false;
      phraseQueue = [];
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      fire('destroy');
      opts.onDestroy?.();
    },
  };

  if (autoPauseOnHidden && typeof document !== 'undefined') {
    unsubscribeVisibility = subscribeVisibility((visible) => {
      fire('visibilitychange', visible);
      opts.onVisibilityChange?.(visible);
      if (visible) {
        pausedByVisibility = false;
        if (running && !paused && phraseQueue.length > 0) playNextInQueue();
      } else {
        pausedByVisibility = true;
        cancelCurrent?.();
        cancelCurrent = null;
      }
    });
  }

  return controller;
}
