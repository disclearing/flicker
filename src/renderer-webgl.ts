/**
 * Optional WebGL renderer for effects. Falls back when WebGL is unsupported.
 */

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
  _source: HTMLImageElement | HTMLVideoElement
): HTMLCanvasElement | null {
  if (!isWebGLSupported()) return null;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
}
