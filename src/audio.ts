/**
 * Audio-reactive flicker: drive intensity/interval from microphone or audio element.
 */

import type { FlickerController } from './types.js';
import { createFlicker } from './flicker.js';

export interface AudioReactiveOptions {
  /** HTML media element (audio/video) or use analyser from stream. */
  source?: HTMLMediaElement | MediaStream;
  /** FFT size for analyser. Default 256. */
  fftSize?: number;
  /** Smoothing (0-1). Default 0.8. */
  smoothingTimeConstant?: number;
  /** Map frequency data to interval: (normalizedLevel) => intervalMs. */
  mapToInterval?: (normalizedLevel: number) => number;
  /** Map frequency data to opacity when "off": (normalizedLevel) => 0-1. */
  mapToOffOpacity?: (normalizedLevel: number) => number;
  /** Minimum interval (ms). */
  minInterval?: number;
  /** Maximum interval (ms). */
  maxInterval?: number;
  /** Callback when analyser errors (e.g. no permission). */
  onError?: (err: Error) => void;
}

const defaultMapToInterval = (n: number) => Math.max(30, 200 - n * 180);
const defaultMapToOffOpacity = (n: number) => 1 - n * 0.8;

/**
 * Create an audio-reactive flicker controller.
 * Uses AnalyserNode to get frequency data and drives flicker interval/opacity from level.
 */
export function createAudioReactiveFlicker(
  element: HTMLElement | HTMLImageElement,
  options: AudioReactiveOptions = {}
): FlickerController {
  const opts = {
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    minInterval: 30,
    maxInterval: 200,
    mapToInterval: defaultMapToInterval,
    mapToOffOpacity: defaultMapToOffOpacity,
    ...options,
  };

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array | null = null;
  let animationId: number | null = null;
  let flickerController: FlickerController | null = null;
  let lastTick = 0;
  let intervalMs = 100;

  function getLevel(): number {
    if (!analyser || !dataArray) return 0;
    (analyser.getByteFrequencyData as (array: Uint8Array) => void)(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return dataArray.length > 0 ? sum / (dataArray.length * 255) : 0;
  }

  function tick() {
    const level = Math.min(1, getLevel());
    intervalMs = Math.max(opts.minInterval!, Math.min(opts.maxInterval!, opts.mapToInterval!(level)));
    const offOpacity = opts.mapToOffOpacity!(level);
    flickerController?.setOptions({ interval: intervalMs, offOpacity });
    animationId = requestAnimationFrame(tick);
  }

  async function connectSource() {
    if (typeof window === 'undefined' || !window.AudioContext && !(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
      opts.onError?.(new Error('AudioContext not supported'));
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new Ctx();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = opts.fftSize!;
    analyser.smoothingTimeConstant = opts.smoothingTimeConstant!;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const source = opts.source;
    if (source instanceof HTMLMediaElement) {
      const src = audioContext.createMediaElementSource(source);
      src.connect(analyser);
      src.connect(audioContext.destination);
    } else if (source instanceof MediaStream) {
      const src = audioContext.createMediaStreamSource(source);
      src.connect(analyser);
    } else {
      opts.onError?.(new Error('No audio source provided'));
      return;
    }
    tick();
  }

  flickerController = createFlicker(element, {
    interval: intervalMs,
    offOpacity: 0,
    engine: 'raf',
  });

  const controller: FlickerController = {
    get isRunning() {
      return flickerController?.isRunning ?? false;
    },
    start() {
      flickerController?.start();
      void connectSource();
    },
    stop() {
      if (animationId != null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      flickerController?.stop();
    },
    setOptions(o) {
      flickerController?.setOptions(o);
    },
    destroy() {
      controller.stop();
      audioContext?.close();
      flickerController?.destroy();
      flickerController = null;
      analyser = null;
      dataArray = null;
    },
  };

  return controller;
}

/**
 * Check if audio-reactive is supported (AudioContext + getUserMedia if needed).
 */
export function isAudioReactiveSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return typeof Ctx === 'function' && typeof navigator?.mediaDevices?.getUserMedia === 'function';
}
