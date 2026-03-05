/**
 * Canvas-based renderer for distortion, noise, and scanline effects.
 * Falls back to no-op when canvas is unsupported.
 */

import { subscribeVisibility } from './engine.js';

export type CanvasEffectType = 'noise' | 'scanline' | 'distortion' | 'none';

export interface CanvasEffectOptions {
  /** Effect type. */
  type: CanvasEffectType;
  /** Noise intensity 0-1. */
  noiseAmount?: number;
  /** Scanline spacing (px). */
  scanlineSpacing?: number;
  /** Scanline opacity 0-1. */
  scanlineOpacity?: number;
  /** Distortion wave amplitude. */
  distortionAmount?: number;
  /** Downscale render size by factor (0.1-1.0). Default: 1. */
  scale?: number;
  /** Limit effect render FPS for CPU savings. Omit/<=0 for full RAF. */
  throttleFps?: number;
  /** Auto-pause render loop when tab is hidden. Default: true. */
  autoPauseOnHidden?: boolean;
}

function getSourceSize(source: HTMLImageElement | HTMLVideoElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.naturalWidth, height: source.naturalHeight };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function normalizeScale(scale?: number): number {
  if (scale == null || !Number.isFinite(scale)) return 1;
  return Math.max(0.1, Math.min(1, scale));
}

function applyEffects(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: CanvasEffectOptions,
  timeSec: number
): void {
  if (options.type === 'noise' && (options.noiseAmount ?? 0.1) > 0) {
    const amount = Math.floor((options.noiseAmount ?? 0.1) * 255);
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() * 2 - 1) * amount;
      data[i] = clampByte(data[i] + n);
      data[i + 1] = clampByte(data[i + 1] + n);
      data[i + 2] = clampByte(data[i + 2] + n);
    }
  }

  if (options.type === 'scanline') {
    const spacing = Math.max(1, Math.floor(options.scanlineSpacing ?? 4));
    const opacity = (options.scanlineOpacity ?? 0.15) * 255;
    for (let y = 0; y < height; y += spacing) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = clampByte(data[i] - opacity);
        data[i + 1] = clampByte(data[i + 1] - opacity);
        data[i + 2] = clampByte(data[i + 2] - opacity);
      }
    }
  }

  if (options.type === 'distortion' && (options.distortionAmount ?? 0) > 0) {
    const amount = options.distortionAmount ?? 2;
    const copy = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = Math.sin((y * 0.1) + (timeSec * 1.7)) * amount + Math.cos((x * 0.05) + (timeSec * 1.1)) * amount;
        const srcX = Math.max(0, Math.min(width - 1, Math.floor(x + offset)));
        const i = (y * width + x) * 4;
        const si = (y * width + srcX) * 4;
        data[i] = copy[si];
        data[i + 1] = copy[si + 1];
        data[i + 2] = copy[si + 2];
      }
    }
  }
}

/**
 * Check if canvas 2D is supported.
 */
export function isCanvasSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('2d');
  } catch {
    return false;
  }
}

/**
 * Create a canvas that mirrors the size of an element and optionally draws an image with effects.
 */
export function createEffectCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  options: CanvasEffectOptions = { type: 'none' }
): HTMLCanvasElement | null {
  if (!isCanvasSupported()) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const context: CanvasRenderingContext2D = ctx;

  const size = getSourceSize(source);
  if (!size.width || !size.height) return null;
  const scale = normalizeScale(options.scale);
  const width = Math.max(1, Math.floor(size.width * scale));
  const height = Math.max(1, Math.floor(size.height * scale));

  canvas.width = width;
  canvas.height = height;

  function draw() {
    context.drawImage(source, 0, 0, width, height);
    const imgData = context.getImageData(0, 0, width, height);
    const data = imgData.data;

    applyEffects(data, width, height, options, performance.now() / 1000);

    context.putImageData(imgData, 0, 0);
  }

  draw();
  return canvas;
}

/**
 * Run a single frame of effect and return canvas (or null if unsupported).
 */
export function renderFrame(
  source: HTMLImageElement | HTMLVideoElement,
  options: CanvasEffectOptions
): HTMLCanvasElement | null {
  return createEffectCanvas(source, options);
}

/**
 * Controller that continuously draws source to canvas with effect. Use for video or animated flicker.
 */
export interface CanvasRendererController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<CanvasEffectOptions>): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | null;
}

export function createCanvasRenderer(
  source: HTMLImageElement | HTMLVideoElement,
  options: CanvasEffectOptions = { type: 'none' }
): CanvasRendererController {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId: number | null = null;
  let running = false;
  let pausedByVisibility = false;
  let unsubscribeVisibility: (() => void) | null = null;
  let destroyed = false;
  let lastFrameMs = 0;
  let currentOptions = { ...options };
  const startedAt = performance.now();

  function resizeToSourceIfNeeded(): boolean {
    if (!canvas) return false;
    const size = getSourceSize(source);
    if (!size.width || !size.height) return false;
    const scale = normalizeScale(currentOptions.scale);
    const nextW = Math.max(1, Math.floor(size.width * scale));
    const nextH = Math.max(1, Math.floor(size.height * scale));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    return true;
  }

  function loop(nowMs: number) {
    if (!canvas || !ctx || !running || destroyed) return;
    const targetFps = currentOptions.throttleFps ?? 0;
    if (targetFps > 0) {
      const frameMinMs = 1000 / targetFps;
      if (nowMs - lastFrameMs < frameMinMs) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      lastFrameMs = nowMs;
    }

    if (!resizeToSourceIfNeeded()) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.drawImage(source, 0, 0, w, h);
    if (currentOptions.type !== 'none') {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      applyEffects(data, w, h, currentOptions, (performance.now() - startedAt) / 1000);
      ctx.putImageData(imgData, 0, 0);
    }
    rafId = requestAnimationFrame(loop);
  }

  const controller: CanvasRendererController = {
    get canvas() {
      return canvas;
    },
    start() {
      if (!isCanvasSupported() || destroyed) return;
      if (running) return;
      running = true;
      if (!canvas) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
      }
      if (!canvas || !ctx) return;
      if (!resizeToSourceIfNeeded()) {
        running = false;
        return;
      }

      if ((currentOptions.autoPauseOnHidden ?? true) && typeof document !== 'undefined' && !unsubscribeVisibility) {
        unsubscribeVisibility = subscribeVisibility((visible) => {
          if (!running) return;
          if (!visible) {
            pausedByVisibility = true;
            if (rafId != null) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
          } else if (pausedByVisibility) {
            pausedByVisibility = false;
            if (rafId == null) rafId = requestAnimationFrame(loop);
          }
        });
      }

      if (rafId == null) {
        lastFrameMs = 0;
        rafId = requestAnimationFrame(loop);
      }
    },
    stop() {
      running = false;
      pausedByVisibility = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    setOptions(o) {
      currentOptions = { ...currentOptions, ...o };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.stop();
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      canvas?.remove();
      canvas = null;
      ctx = null;
    },
  };

  return controller;
}
