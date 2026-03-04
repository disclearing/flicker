/**
 * Canvas-based renderer for distortion, noise, and scanline effects.
 * Falls back to no-op when canvas is unsupported.
 */

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

  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return null;

  canvas.width = width;
  canvas.height = height;

  function draw() {
    context.drawImage(source, 0, 0, width, height);
    const imgData = context.getImageData(0, 0, width, height);
    const data = imgData.data;

    if (options.type === 'noise' && (options.noiseAmount ?? 0.1) > 0) {
      const amount = Math.floor((options.noiseAmount ?? 0.1) * 255);
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 2 - 1) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
      }
    }

    if (options.type === 'scanline') {
      const spacing = options.scanlineSpacing ?? 4;
      const opacity = (options.scanlineOpacity ?? 0.15) * 255;
      for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          data[i] = Math.max(0, data[i] - opacity);
          data[i + 1] = Math.max(0, data[i + 1] - opacity);
          data[i + 2] = Math.max(0, data[i + 2] - opacity);
        }
      }
    }

    if (options.type === 'distortion' && (options.distortionAmount ?? 0) > 0) {
      const amount = options.distortionAmount ?? 2;
      const copy = new Uint8ClampedArray(data);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = Math.sin(y * 0.1) * amount + Math.cos(x * 0.05) * amount;
          const srcX = Math.max(0, Math.min(width - 1, Math.floor(x + offset)));
          const i = (y * width + x) * 4;
          const si = (y * width + srcX) * 4;
          data[i] = copy[si];
          data[i + 1] = copy[si + 1];
          data[i + 2] = copy[si + 2];
        }
      }
    }

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
  let rafId: number | null = null;
  let currentOptions = { ...options };

  function loop() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.drawImage(source, 0, 0, w, h);
    if (currentOptions.type !== 'none') {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      if (currentOptions.type === 'noise' && (currentOptions.noiseAmount ?? 0) > 0) {
        const amount = Math.floor((currentOptions.noiseAmount ?? 0.1) * 255);
        for (let i = 0; i < data.length; i += 4) {
          const n = (Math.random() * 2 - 1) * amount;
          data[i] = Math.max(0, Math.min(255, data[i] + n));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
        }
      }
      if (currentOptions.type === 'scanline') {
        const spacing = currentOptions.scanlineSpacing ?? 4;
        const opacity = (currentOptions.scanlineOpacity ?? 0.15) * 255;
        for (let y = 0; y < h; y += spacing) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = Math.max(0, data[i] - opacity);
            data[i + 1] = Math.max(0, data[i + 1] - opacity);
            data[i + 2] = Math.max(0, data[i + 2] - opacity);
          }
        }
      }
      const ctx2 = canvas.getContext('2d');
      if (ctx2) ctx2.putImageData(imgData, 0, 0);
    }
    rafId = requestAnimationFrame(loop);
  }

  const controller: CanvasRendererController = {
    get canvas() {
      return canvas;
    },
    start() {
      if (!isCanvasSupported()) return;
      if (canvas) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
      if (!w || !h) return;
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    setOptions(o) {
      currentOptions = { ...currentOptions, ...o };
    },
    destroy() {
      controller.stop();
      canvas?.remove();
      canvas = null;
    },
  };

  return controller;
}
