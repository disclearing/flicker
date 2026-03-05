/**
 * Optional WebGL renderer for effects. Falls back when WebGL is unsupported.
 */

import type { CanvasEffectOptions } from './renderer-canvas.js';

export function isWebGLSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/**
 * Create a WebGL canvas that draws a source image with a simple pass-through or effect.
 * Returns null if WebGL unsupported.
 */
export function createWebGLCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  options: CanvasEffectOptions = { type: 'none' }
): HTMLCanvasElement | null {
  if (!isWebGLSupported()) return null;
  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;

  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return null;
  canvas.width = width;
  canvas.height = height;

  const vertexShaderSource = `
    attribute vec2 aPosition;
    attribute vec2 aUv;
    varying vec2 vUv;
    void main() {
      vUv = aUv;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;
  const fragmentShaderSource = `
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

  const compileShader = (type: number, sourceCode: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    vertexShader && gl.deleteShader(vertexShader);
    fragmentShader && gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);

  const vertices = new Float32Array([
    // x, y, u, v
    -1, -1, 0, 1,
     1, -1, 1, 1,
    -1,  1, 0, 0,
    -1,  1, 0, 0,
     1, -1, 1, 1,
     1,  1, 1, 0,
  ]);
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  const aUv = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  } catch {
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    return null;
  }

  const effectType =
    options.type === 'noise' ? 1 :
    options.type === 'scanline' ? 2 :
    options.type === 'distortion' ? 3 : 0;

  const setUniform1f = (name: string, value: number) => {
    const loc = gl.getUniformLocation(program, name);
    if (loc !== null) gl.uniform1f(loc, value);
  };
  const setUniform2f = (name: string, x: number, y: number) => {
    const loc = gl.getUniformLocation(program, name);
    if (loc !== null) gl.uniform2f(loc, x, y);
  };

  setUniform1f('uEffectType', effectType);
  setUniform1f('uNoiseAmount', options.noiseAmount ?? 0.1);
  setUniform1f('uScanlineSpacing', options.scanlineSpacing ?? 4);
  setUniform1f('uScanlineOpacity', options.scanlineOpacity ?? 0.15);
  setUniform1f('uDistortionAmount', options.distortionAmount ?? 2);
  setUniform1f('uTime', performance.now() / 1000);
  setUniform2f('uResolution', width, height);

  const textureLoc = gl.getUniformLocation(program, 'uTexture');
  if (textureLoc !== null) gl.uniform1i(textureLoc, 0);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  return canvas;
}
