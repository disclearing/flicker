/**
 * Optional WebGL renderer for effects. Falls back when WebGL is unsupported.
 */

import { subscribeVisibility } from './engine.js';
import type { CanvasEffectOptions } from './renderer-canvas.js';

export interface WebGLRendererOptions extends CanvasEffectOptions {
  /** Recreate canvas size when source dimensions change. Default: true. */
  autoResize?: boolean;
  /** Auto-pause render loop when tab is hidden. Default: true. */
  autoPauseOnHidden?: boolean;
  /** Called when WebGL context is lost. */
  onContextLost?: (event: Event) => void;
  /** Called on setup or draw failures. */
  onError?: (error: Error) => void;
}

export interface WebGLRendererController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<WebGLRendererOptions>): void;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | null;
  readonly isRunning: boolean;
}

export function isWebGLSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function getSourceSize(source: HTMLImageElement | HTMLVideoElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.naturalWidth, height: source.naturalHeight };
}

function effectTypeToNumber(type: CanvasEffectOptions['type']): number {
  if (type === 'noise') return 1;
  if (type === 'scanline') return 2;
  if (type === 'distortion') return 3;
  return 0;
}

const VERTEX_SHADER_SOURCE = `
  attribute vec2 aPosition;
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uEffectType; // 0=none,1=noise,2=scanline,3=distortion
  uniform float uNoiseAmount;
  uniform float uScanlineSpacing;
  uniform float uScanlineOpacity;
  uniform float uDistortionAmount;
  uniform float uTime;
  uniform vec2 uResolution;

  float rand(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    if (uEffectType == 3.0) {
      float amp = uDistortionAmount / max(uResolution.x, 1.0);
      uv.x += sin((uv.y + uTime * 0.6) * 30.0) * amp;
    }

    vec4 color = texture2D(uTexture, uv);

    if (uEffectType == 1.0) {
      float n = (rand(uv + vec2(uTime, uTime * 0.37)) - 0.5) * uNoiseAmount;
      color.rgb += vec3(n, n, n);
    }

    if (uEffectType == 2.0) {
      float yPx = uv.y * uResolution.y;
      float line = floor(yPx / max(uScanlineSpacing, 1.0));
      float isDarkLine = step(0.5, fract(line * 0.5));
      color.rgb *= (1.0 - (isDarkLine * uScanlineOpacity));
    }

    gl_FragColor = color;
  }
`;

interface WebGLResources {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  aPosition: number;
  aUv: number;
  uTexture: WebGLUniformLocation | null;
  uEffectType: WebGLUniformLocation | null;
  uNoiseAmount: WebGLUniformLocation | null;
  uScanlineSpacing: WebGLUniformLocation | null;
  uScanlineOpacity: WebGLUniformLocation | null;
  uDistortionAmount: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
}

function createNoopController(): WebGLRendererController {
  return {
    start() {},
    stop() {},
    setOptions() {},
    destroy() {},
    get canvas() { return null; },
    get isRunning() { return false; },
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, sourceCode: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createResources(gl: WebGLRenderingContext): WebGLResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array([
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
    -1,  1, 0, 0,
     1, -1, 1, 1,
     1,  1, 1, 0,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  const aUv = gl.getAttribLocation(program, 'aUv');
  if (aPosition < 0 || aUv < 0) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }

  const texture = gl.createTexture();
  if (!texture) {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    program,
    buffer,
    texture,
    aPosition,
    aUv,
    uTexture: gl.getUniformLocation(program, 'uTexture'),
    uEffectType: gl.getUniformLocation(program, 'uEffectType'),
    uNoiseAmount: gl.getUniformLocation(program, 'uNoiseAmount'),
    uScanlineSpacing: gl.getUniformLocation(program, 'uScanlineSpacing'),
    uScanlineOpacity: gl.getUniformLocation(program, 'uScanlineOpacity'),
    uDistortionAmount: gl.getUniformLocation(program, 'uDistortionAmount'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uResolution: gl.getUniformLocation(program, 'uResolution'),
  };
}

function deleteResources(gl: WebGLRenderingContext, resources: WebGLResources | null): void {
  if (!resources) return;
  gl.deleteTexture(resources.texture);
  gl.deleteBuffer(resources.buffer);
  gl.deleteProgram(resources.program);
}

/**
 * Create and control a WebGL renderer for source image/video.
 * Returns no-op controller with null canvas if WebGL unsupported.
 */
export function createWebGLRenderer(
  source: HTMLImageElement | HTMLVideoElement,
  options: WebGLRendererOptions = { type: 'none' }
): WebGLRendererController {
  if (!isWebGLSupported()) return createNoopController();
  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return createNoopController();

  let opts: WebGLRendererOptions = {
    autoResize: true,
    autoPauseOnHidden: true,
    ...options,
  };
  let resources: WebGLResources | null = createResources(gl);
  if (!resources) {
    opts.onError?.(new Error('Failed to initialize WebGL resources'));
    return createNoopController();
  }

  let running = false;
  let destroyed = false;
  let pausedByVisibility = false;
  let contextLost = false;
  let rafId: number | null = null;
  let unsubscribeVisibility: (() => void) | null = null;

  const render = (timeSec: number): void => {
    if (!resources || contextLost) return;
    const { width, height } = getSourceSize(source);
    if (!width || !height) return;

    if (opts.autoResize !== false || canvas.width === 0 || canvas.height === 0) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    gl.useProgram(resources.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
    gl.enableVertexAttribArray(resources.aPosition);
    gl.vertexAttribPointer(resources.aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(resources.aUv);
    gl.vertexAttribPointer(resources.aUv, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      // Source may not be readable yet (e.g. video metadata/frame not ready).
      return;
    }

    if (resources.uTexture !== null) gl.uniform1i(resources.uTexture, 0);
    if (resources.uEffectType !== null) gl.uniform1f(resources.uEffectType, effectTypeToNumber(opts.type));
    if (resources.uNoiseAmount !== null) gl.uniform1f(resources.uNoiseAmount, opts.noiseAmount ?? 0.1);
    if (resources.uScanlineSpacing !== null) gl.uniform1f(resources.uScanlineSpacing, opts.scanlineSpacing ?? 4);
    if (resources.uScanlineOpacity !== null) gl.uniform1f(resources.uScanlineOpacity, opts.scanlineOpacity ?? 0.15);
    if (resources.uDistortionAmount !== null) gl.uniform1f(resources.uDistortionAmount, opts.distortionAmount ?? 2);
    if (resources.uTime !== null) gl.uniform1f(resources.uTime, timeSec);
    if (resources.uResolution !== null) gl.uniform2f(resources.uResolution, canvas.width, canvas.height);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const loop = (timestamp: number): void => {
    if (destroyed || !running || pausedByVisibility || contextLost) return;
    render(timestamp / 1000);
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = (): void => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const onContextLost = (event: Event) => {
    if (typeof (event as { preventDefault?: () => void }).preventDefault === 'function') {
      (event as { preventDefault: () => void }).preventDefault();
    }
    contextLost = true;
    stopLoop();
    opts.onContextLost?.(event);
    opts.onError?.(new Error('WebGL context lost'));
  };

  const onContextRestored = () => {
    if (destroyed) return;
    contextLost = false;
    deleteResources(gl, resources);
    resources = createResources(gl);
    if (!resources) {
      opts.onError?.(new Error('Failed to restore WebGL resources after context loss'));
      return;
    }
    if (running && !pausedByVisibility) {
      render(performance.now() / 1000);
      rafId = requestAnimationFrame(loop);
    }
  };

  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  return {
    start() {
      if (destroyed || running) return;
      running = true;
      pausedByVisibility = false;
      if (opts.autoPauseOnHidden !== false && typeof document !== 'undefined') {
        unsubscribeVisibility?.();
        unsubscribeVisibility = subscribeVisibility((isVisible) => {
          if (isVisible) {
            if (pausedByVisibility && running && !contextLost) {
              pausedByVisibility = false;
              render(performance.now() / 1000);
              rafId = requestAnimationFrame(loop);
            }
          } else if (running && !pausedByVisibility) {
            pausedByVisibility = true;
            stopLoop();
          }
        });
      }
      render(performance.now() / 1000);
      if (!contextLost) {
        rafId = requestAnimationFrame(loop);
      }
    },
    stop() {
      running = false;
      pausedByVisibility = false;
      stopLoop();
    },
    setOptions(nextOptions) {
      opts = { ...opts, ...nextOptions };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      stopLoop();
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      deleteResources(gl, resources);
      resources = null;
    },
    get canvas() {
      return canvas;
    },
    get isRunning() {
      return running && !pausedByVisibility && !contextLost;
    },
  };
}

/**
 * Create a WebGL canvas that draws a source image with a simple pass-through or effect.
 * Returns null if WebGL unsupported.
 */
export function createWebGLCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  options: WebGLRendererOptions = { type: 'none' }
): HTMLCanvasElement | null {
  const renderer = createWebGLRenderer(source, options);
  const canvas = renderer.canvas;
  if (!canvas) return null;
  renderer.start();
  renderer.stop();
  renderer.destroy();
  return canvas;
}
