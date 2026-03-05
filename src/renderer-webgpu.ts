/**
 * WebGPU renderer for image/video effects with graceful fallback.
 * Supports pass-through + lightweight noise/scanline/distortion in shader.
 */

import type { CanvasEffectOptions } from './renderer-canvas.js';

type WebGPUPowerPreference = 'low-power' | 'high-performance';

export interface WebGPURendererOptions extends CanvasEffectOptions {
  /** Preferred power profile for adapter selection. */
  powerPreference?: WebGPUPowerPreference;
  /** Recreate textures/canvas size when source dimensions change. Default: true. */
  autoResize?: boolean;
  /** Called when GPU device is lost. */
  onDeviceLost?: (info: unknown) => void;
}

export interface WebGPURendererController {
  start(): void;
  stop(): void;
  setOptions(options: Partial<WebGPURendererOptions>): void;
  /** Resolve when initialization is complete (true on success). */
  ready(): Promise<boolean>;
  destroy(): void;
  readonly canvas: HTMLCanvasElement | null;
  readonly isInitialized: boolean;
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

/**
 * Check if WebGPU is available in this environment.
 */
export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  const gpu = (navigator as unknown as { gpu?: unknown }).gpu;
  return gpu != null;
}

const WGSL_SHADER = `
struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct Params {
  effectType: f32,
  noiseAmount: f32,
  scanlineSpacing: f32,
  distortionAmount: f32,
  time: f32,
  width: f32,
  height: f32,
  scanlineOpacity: f32,
}

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VSOut {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var out: VSOut;
  out.position = vec4<f32>(positions[vi], 0.0, 1.0);
  out.uv = uvs[vi];
  return out;
}

fn rand2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  var uv = in.uv;
  if (params.effectType == 3.0) {
    let amp = params.distortionAmount / max(params.width, 1.0);
    uv.x = uv.x + sin((uv.y + params.time * 0.6) * 30.0) * amp;
  }
  var color = textureSample(sourceTexture, sourceSampler, uv);

  if (params.effectType == 1.0) {
    let n = (rand2(uv + vec2<f32>(params.time, params.time * 0.37)) - 0.5) * params.noiseAmount;
    color.rgb = color.rgb + vec3<f32>(n, n, n);
  }

  if (params.effectType == 2.0) {
    let yPx = uv.y * params.height;
    let line = floor(yPx / max(params.scanlineSpacing, 1.0));
    let isDarkLine = fract(line * 0.5) < 0.5;
    if (isDarkLine) {
      color.rgb = color.rgb * (1.0 - params.scanlineOpacity);
    }
  }

  return color;
}
`;

/**
 * Create and start a WebGPU renderer for source image/video.
 * If unsupported or init fails, returned controller remains inert.
 */
export function createWebGPURenderer(
  source: HTMLImageElement | HTMLVideoElement,
  options: WebGPURendererOptions = { type: 'none' }
): WebGPURendererController {
  let canvas: HTMLCanvasElement | null = null;
  let rafId: number | null = null;
  let running = false;
  let destroyed = false;
  let initialized = false;
  let initializing = false;
  let readyPromise: Promise<boolean> | null = null;
  let currentOptions: WebGPURendererOptions = { ...options };
  currentOptions.type = currentOptions.type ?? 'none';
  currentOptions.noiseAmount = currentOptions.noiseAmount ?? 0.1;
  currentOptions.scanlineSpacing = currentOptions.scanlineSpacing ?? 4;
  currentOptions.scanlineOpacity = currentOptions.scanlineOpacity ?? 0.15;
  currentOptions.distortionAmount = currentOptions.distortionAmount ?? 2;
  currentOptions.autoResize = currentOptions.autoResize ?? true;

  let device: any = null;
  let adapter: any = null;
  let context: any = null;
  let pipeline: any = null;
  let sampler: any = null;
  let uniformBuffer: any = null;
  let sourceTexture: any = null;
  let bindGroup: any = null;
  let format = 'bgra8unorm';
  let textureWidth = 0;
  let textureHeight = 0;
  const startedAt = performance.now();

  function resetGpuResources(clearCanvas: boolean): void {
    try {
      sourceTexture?.destroy?.();
    } catch {
      // ignore
    }
    bindGroup = null;
    sourceTexture = null;
    textureWidth = 0;
    textureHeight = 0;
    uniformBuffer = null;
    sampler = null;
    pipeline = null;
    context = null;
    device = null;
    adapter = null;
    initialized = false;
    if (clearCanvas) {
      canvas?.remove();
      canvas = null;
    }
  }

  function getWebGPUUsage(): { texture: any; buffer: any } | null {
    const usage = globalThis as unknown as {
      GPUTextureUsage?: any;
      GPUBufferUsage?: any;
    };
    if (!usage.GPUTextureUsage || !usage.GPUBufferUsage) return null;
    return {
      texture: usage.GPUTextureUsage,
      buffer: usage.GPUBufferUsage,
    };
  }

  function configureContextForSize(width: number, height: number): boolean {
    if (!canvas || !context || !device) return false;
    if (!width || !height) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });
    return true;
  }

  function recreateTextureAndBindGroup(width: number, height: number): boolean {
    if (!device || !pipeline || !sampler || !uniformBuffer) return false;
    const usage = getWebGPUUsage();
    if (!usage) return false;
    try {
      sourceTexture?.destroy?.();
    } catch {
      // ignore
    }
    sourceTexture = device.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: usage.texture.TEXTURE_BINDING | usage.texture.COPY_DST | usage.texture.RENDER_ATTACHMENT,
    });
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceTexture.createView() },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });
    textureWidth = width;
    textureHeight = height;
    return true;
  }

  function ensureSizedToSource(): boolean {
    if (!initialized || !canvas || !context || !device) return false;
    const size = getSourceSize(source);
    if (!size.width || !size.height) return false;
    if (!configureContextForSize(size.width, size.height)) return false;
    if (textureWidth !== size.width || textureHeight !== size.height) {
      return recreateTextureAndBindGroup(size.width, size.height);
    }
    return true;
  }

  async function init(): Promise<boolean> {
    if (initialized || destroyed) return initialized;
    if (initializing && readyPromise) return readyPromise;

    initializing = true;
    readyPromise = (async () => {
      if (!isWebGPUSupported()) return false;
      const size = getSourceSize(source);
      if (!size.width || !size.height) return false;
      const usage = getWebGPUUsage();
      if (!usage) return false;

      if (!canvas) canvas = document.createElement('canvas');
      const navGpu = (navigator as unknown as { gpu: any }).gpu;
      if (!adapter) {
        adapter = await navGpu.requestAdapter({
          powerPreference: currentOptions.powerPreference ?? 'high-performance',
        });
      }
      if (!adapter) return false;

      device = await adapter.requestDevice();
      device.lost?.then((info: unknown) => {
        if (destroyed) return;
        running = false;
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        resetGpuResources(false);
        currentOptions.onDeviceLost?.(info);
      });

      context = canvas.getContext('webgpu');
      if (!context) return false;
      if (typeof navGpu.getPreferredCanvasFormat === 'function') {
        format = navGpu.getPreferredCanvasFormat();
      }
      if (!configureContextForSize(size.width, size.height)) return false;

      const shaderModule = device.createShaderModule({ code: WGSL_SHADER });
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vsMain' },
        fragment: {
          module: shaderModule,
          entryPoint: 'fsMain',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
      });

      sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

      uniformBuffer = device.createBuffer({
        size: 8 * 4,
        usage: usage.buffer.UNIFORM | usage.buffer.COPY_DST,
      });

      if (!recreateTextureAndBindGroup(size.width, size.height)) return false;

      initialized = true;
      return true;
    })()
      .catch(() => false)
      .finally(() => {
        initializing = false;
      });

    return readyPromise;
  }

  function frame(): void {
    if (!initialized || !canvas || !device || !context || !pipeline || !sourceTexture || !uniformBuffer || !bindGroup) {
      return;
    }
    if ((currentOptions.autoResize ?? true) && !ensureSizedToSource()) {
      return;
    }
    try {
      const elapsed = (performance.now() - startedAt) / 1000;
      const params = new Float32Array([
        effectTypeToNumber(currentOptions.type),
        currentOptions.noiseAmount ?? 0.1,
        currentOptions.scanlineSpacing ?? 4,
        currentOptions.distortionAmount ?? 2,
        elapsed,
        canvas.width,
        canvas.height,
        currentOptions.scanlineOpacity ?? 0.15,
      ]);
      device.queue.writeBuffer(uniformBuffer, 0, params.buffer);

      device.queue.copyExternalImageToTexture(
        { source },
        { texture: sourceTexture },
        [canvas.width, canvas.height]
      );

      const encoder = device.createCommandEncoder();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6, 1, 0, 0);
      renderPass.end();
      device.queue.submit([encoder.finish()]);
    } catch {
      // Source may not be ready this frame (e.g. video metadata not loaded yet).
      // Keep loop alive and retry next frame.
    }
  }

  function loop(): void {
    if (destroyed || !running) return;
    frame();
    rafId = requestAnimationFrame(loop);
  }

  const controller: WebGPURendererController = {
    get canvas() {
      return canvas;
    },
    get isInitialized() {
      return initialized;
    },
    setOptions(next) {
      currentOptions = { ...currentOptions, ...next };
    },
    ready() {
      return init();
    },
    start() {
      if (destroyed) return;
      if (running) return;
      running = true;
      if (rafId != null) return;
      void controller.ready().then((ok) => {
        if (!ok || destroyed || !running) return;
        rafId = requestAnimationFrame(loop);
      });
    },
    stop() {
      running = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.stop();
      resetGpuResources(true);
    },
  };

  return controller;
}

/**
 * Convenience helper: create renderer, start it, and return canvas.
 * Returns null when WebGPU is unavailable or initialization fails.
 */
export async function createWebGPUCanvas(
  source: HTMLImageElement | HTMLVideoElement,
  options: WebGPURendererOptions = { type: 'none' }
): Promise<HTMLCanvasElement | null> {
  const renderer = createWebGPURenderer(source, options);
  const ok = await renderer.ready();
  if (!ok) {
    renderer.destroy();
    return null;
  }
  renderer.start();
  // Wait a frame so the first render pass can submit.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return renderer.canvas;
}
