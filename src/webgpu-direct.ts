/**
 * Direct WebGPU helpers: device/context, compute, and scene-style 3D rendering.
 * This API intentionally mirrors a small but practical subset of Three.js workflows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Mat4 = Float32Array;
type Vec3 = [number, number, number];

const IDENTITY_MAT4 = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const BASIC_3D_WGSL = `
struct Uniforms {
  model: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  baseColor: vec4<f32>,
  useVertexColor: f32,
  _padding: vec3<f32>,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
}

@vertex
fn vsMain(@location(0) pos: vec3<f32>, @location(1) color: vec4<f32>) -> VSOut {
  var out: VSOut;
  out.position = u.viewProjection * u.model * vec4<f32>(pos, 1.0);
  out.color = select(u.baseColor, color * u.baseColor, u.useVertexColor > 0.5);
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  return in.color;
}
`;

const UNIFORM_F32_COUNT = 40; // model(16) + viewProj(16) + color(4) + useVertexColor/padding(4)
const UNIFORM_SIZE_BYTES = UNIFORM_F32_COUNT * 4;

export interface RequestWebGPUDeviceOptions {
  powerPreference?: 'low-power' | 'high-performance';
  onDeviceLost?: (info: unknown) => void;
}

export interface WebGPUDeviceResult {
  device: any;
  adapter: any;
}

export interface ConfigureWebGPUCanvasOptions {
  format?: string;
  alphaMode?: 'opaque' | 'premultiplied';
}

export interface CreateComputePipelineOptions {
  entryPoint?: string;
  label?: string;
}

export interface WebGPUGeometryData {
  /** XYZ triplets (required). */
  positions: Float32Array;
  /** Optional RGBA (0..1) per vertex. Auto-filled with white if omitted. */
  colors?: Float32Array;
  /** Optional index buffer. */
  indices?: Uint16Array | Uint32Array;
}

export interface WebGPUMaterialOptions {
  color?: [number, number, number, number?];
  useVertexColor?: boolean;
}

export interface WebGPUMeshTransform {
  position?: Vec3;
  rotationEuler?: Vec3;
  scale?: Vec3;
  matrix?: Mat4;
}

export interface WebGPUMesh {
  readonly id: number;
  readonly geometry: WebGPUGeometryData;
  setTransform(transform: WebGPUMeshTransform): void;
  setModelMatrix(matrix: Mat4): void;
  setColor(r: number, g: number, b: number, a?: number): void;
  setUseVertexColor(enabled: boolean): void;
  destroy(): void;
}

export interface WebGPUSceneRendererOptions {
  powerPreference?: 'low-power' | 'high-performance';
  onDeviceLost?: (info: unknown) => void;
  clearColor?: [number, number, number, number];
  depthFormat?: string;
}

export interface WebGPUSceneRenderer {
  readonly device: any;
  readonly context: any;
  readonly canvas: HTMLCanvasElement;
  readonly meshCount: number;
  setClearColor(r: number, g: number, b: number, a?: number): void;
  setViewProjection(matrix: Mat4): void;
  resize(width: number, height: number): void;
  createMesh(geometry: WebGPUGeometryData, material?: WebGPUMaterialOptions): WebGPUMesh;
  addMesh(mesh: WebGPUMesh): void;
  removeMesh(mesh: WebGPUMesh): void;
  render(): void;
  destroy(): void;
}

export interface WebGPU3DSceneOptions {
  powerPreference?: 'low-power' | 'high-performance';
  onDeviceLost?: (info: unknown) => void;
  clearColor?: [number, number, number, number];
}

export interface WebGPU3DScene {
  readonly device: any;
  readonly context: any;
  readonly canvas: HTMLCanvasElement;
  setViewProjection(matrix: Mat4): void;
  setModel(matrix: Mat4): void;
  setColor(r: number, g: number, b: number, a?: number): void;
  draw(_encoder: any, pass: any): void;
  render(): void;
  destroy(): void;
}

function getGpuPreferredCanvasFormat(): string {
  if (typeof navigator === 'undefined') return 'bgra8unorm';
  const gpu = (navigator as any).gpu;
  if (typeof gpu?.getPreferredCanvasFormat === 'function') {
    return gpu.getPreferredCanvasFormat();
  }
  return 'bgra8unorm';
}

function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function composeTRS(position: Vec3, rotationEuler: Vec3, scale: Vec3): Mat4 {
  const [px, py, pz] = position;
  const [rx, ry, rz] = rotationEuler;
  const [sx, sy, sz] = scale;
  const cx = Math.cos(rx);
  const sxr = Math.sin(rx);
  const cy = Math.cos(ry);
  const syr = Math.sin(ry);
  const cz = Math.cos(rz);
  const szr = Math.sin(rz);

  // Rotation order: Z * Y * X
  const m00 = cz * cy;
  const m01 = cz * syr * sxr - szr * cx;
  const m02 = cz * syr * cx + szr * sxr;
  const m10 = szr * cy;
  const m11 = szr * syr * sxr + cz * cx;
  const m12 = szr * syr * cx - cz * sxr;
  const m20 = -syr;
  const m21 = cy * sxr;
  const m22 = cy * cx;

  return new Float32Array([
    m00 * sx, m01 * sx, m02 * sx, 0,
    m10 * sy, m11 * sy, m12 * sy, 0,
    m20 * sz, m21 * sz, m22 * sz, 0,
    px, py, pz, 1,
  ]);
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function fillVertexColors(vertexCount: number, rgba: [number, number, number, number]): Float32Array {
  const out = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    out[i * 4] = rgba[0];
    out[i * 4 + 1] = rgba[1];
    out[i * 4 + 2] = rgba[2];
    out[i * 4 + 3] = rgba[3];
  }
  return out;
}

function ensureColors(positions: Float32Array, colors?: Float32Array): Float32Array {
  const vertexCount = Math.floor(positions.length / 3);
  if (colors && colors.length === vertexCount * 4) return colors;
  return fillVertexColors(vertexCount, [1, 1, 1, 1]);
}

function ensureCanvasPixelSize(canvas: HTMLCanvasElement): void {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const cssW = Math.max(1, Math.floor(canvas.clientWidth || canvas.width || 1));
  const cssH = Math.max(1, Math.floor(canvas.clientHeight || canvas.height || 1));
  const w = Math.floor(cssW * dpr);
  const h = Math.floor(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function getBufferUsages(): { vertex: number; index: number; uniform: number; copyDst: number } {
  const usage = (globalThis as any).GPUBufferUsage;
  return {
    vertex: usage.VERTEX,
    index: usage.INDEX,
    uniform: usage.UNIFORM,
    copyDst: usage.COPY_DST,
  };
}

/** Check if WebGPU is available (navigator.gpu exists). */
export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as any).gpu != null;
}

export async function requestWebGPUDevice(
  options: RequestWebGPUDeviceOptions = {}
): Promise<WebGPUDeviceResult | null> {
  if (!isWebGPUSupported()) return null;
  const gpu = (navigator as any).gpu;
  const adapter = await gpu.requestAdapter({
    powerPreference: options.powerPreference ?? 'high-performance',
  });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  device.lost?.then((info: unknown) => options.onDeviceLost?.(info));
  return { device, adapter };
}

export function configureWebGPUCanvas(
  canvas: HTMLCanvasElement,
  device: any,
  options: ConfigureWebGPUCanvasOptions = {}
): any {
  const context = canvas.getContext('webgpu') as any;
  if (!context) return null;
  const format = options.format ?? getGpuPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: options.alphaMode ?? 'premultiplied',
  });
  return context;
}

export function createComputePipeline(
  device: any,
  wgslCode: string,
  options: CreateComputePipelineOptions = {}
): any {
  const module = device.createShaderModule({
    code: wgslCode,
    label: options.label ? `${options.label}-shader` : undefined,
  });
  return device.createComputePipeline({
    label: options.label,
    layout: 'auto',
    compute: {
      module,
      entryPoint: options.entryPoint ?? 'main',
    },
  });
}

export function dispatchCompute(
  encoder: any,
  pipeline: any,
  bindGroups: any[],
  workgroupCount: [number, number?, number?]
): void {
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  bindGroups.forEach((bg, i) => pass.setBindGroup(i, bg));
  pass.dispatchWorkgroups(workgroupCount[0], workgroupCount[1] ?? 1, workgroupCount[2] ?? 1);
  pass.end();
}

interface InternalMeshState {
  id: number;
  geometry: WebGPUGeometryData;
  model: Mat4;
  baseColor: Float32Array;
  useVertexColor: number;
  positionBuffer: any;
  colorBuffer: any;
  indexBuffer: any | null;
  indexFormat: 'uint16' | 'uint32' | null;
  indexCount: number;
  vertexCount: number;
  uniformBuffer: any;
  bindGroup: any;
  destroyed: boolean;
}

export async function createWebGPUSceneRenderer(
  canvas: HTMLCanvasElement,
  options: WebGPUSceneRendererOptions = {}
): Promise<WebGPUSceneRenderer | null> {
  const deviceResult = await requestWebGPUDevice({
    powerPreference: options.powerPreference,
    onDeviceLost: options.onDeviceLost,
  });
  if (!deviceResult) return null;

  const { device } = deviceResult;
  ensureCanvasPixelSize(canvas);
  const context = configureWebGPUCanvas(canvas, device, { format: getGpuPreferredCanvasFormat() });
  if (!context) return null;

  const clearColor = new Float32Array(options.clearColor ?? [0.1, 0.1, 0.15, 1]);
  const viewProjection = new Float32Array(IDENTITY_MAT4);
  const meshes = new Map<number, InternalMeshState>();
  const usages = getBufferUsages();
  let destroyed = false;
  let nextMeshId = 1;
  let depthTexture: any | null = null;
  const colorFormat = getGpuPreferredCanvasFormat();
  const depthFormat = options.depthFormat ?? 'depth24plus';

  const shaderModule = device.createShaderModule({ code: BASIC_3D_WGSL });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vsMain',
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }],
        },
        {
          arrayStride: 16,
          attributes: [{ shaderLocation: 1, format: 'float32x4', offset: 0 }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsMain',
      targets: [{ format: colorFormat }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'ccw',
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });

  function ensureDepthTexture(): void {
    if (depthTexture && depthTexture.width === canvas.width && depthTexture.height === canvas.height) return;
    try {
      depthTexture?.destroy?.();
    } catch {
      // ignore
    }
    depthTexture = device.createTexture({
      size: [Math.max(canvas.width, 1), Math.max(canvas.height, 1), 1],
      format: depthFormat,
      usage: (globalThis as any).GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  function writeMeshUniform(mesh: InternalMeshState): void {
    const data = new Float32Array(UNIFORM_F32_COUNT);
    data.set(mesh.model, 0);
    data.set(viewProjection, 16);
    data.set(mesh.baseColor, 32);
    data[36] = mesh.useVertexColor;
    device.queue.writeBuffer(mesh.uniformBuffer, 0, data.buffer, data.byteOffset, UNIFORM_SIZE_BYTES);
  }

  function drawMesh(pass: any, mesh: InternalMeshState): void {
    if (mesh.destroyed) return;
    writeMeshUniform(mesh);
    pass.setBindGroup(0, mesh.bindGroup);
    pass.setVertexBuffer(0, mesh.positionBuffer);
    pass.setVertexBuffer(1, mesh.colorBuffer);
    if (mesh.indexBuffer) {
      pass.setIndexBuffer(mesh.indexBuffer, mesh.indexFormat!);
      pass.drawIndexed(mesh.indexCount, 1, 0, 0, 0);
    } else {
      pass.draw(mesh.vertexCount, 1, 0, 0);
    }
  }

  function destroyInternalMesh(mesh: InternalMeshState): void {
    if (mesh.destroyed) return;
    mesh.destroyed = true;
    mesh.positionBuffer.destroy();
    mesh.colorBuffer.destroy();
    mesh.indexBuffer?.destroy?.();
    mesh.uniformBuffer.destroy();
  }

  const scene: WebGPUSceneRenderer = {
    get device() {
      return device;
    },
    get context() {
      return context;
    },
    get canvas() {
      return canvas;
    },
    get meshCount() {
      return meshes.size;
    },
    setClearColor(r: number, g: number, b: number, a = 1) {
      clearColor[0] = r;
      clearColor[1] = g;
      clearColor[2] = b;
      clearColor[3] = a;
    },
    setViewProjection(matrix: Mat4) {
      viewProjection.set(matrix);
    },
    resize(width: number, height: number) {
      if (destroyed) return;
      if (!width || !height) return;
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
      context.configure({
        device,
        format: colorFormat,
        alphaMode: 'premultiplied',
      });
      ensureDepthTexture();
    },
    createMesh(geometry: WebGPUGeometryData, material: WebGPUMaterialOptions = {}) {
      const positions = geometry.positions;
      const colors = ensureColors(positions, geometry.colors);
      const vertexCount = Math.floor(positions.length / 3);
      const indexData = geometry.indices ?? null;
      const indexFormat: 'uint16' | 'uint32' | null =
        indexData instanceof Uint32Array ? 'uint32' : indexData ? 'uint16' : null;

      const positionBuffer = device.createBuffer({
        size: positions.byteLength,
        usage: usages.vertex | usages.copyDst,
      });
      device.queue.writeBuffer(positionBuffer, 0, positions);

      const colorBuffer = device.createBuffer({
        size: colors.byteLength,
        usage: usages.vertex | usages.copyDst,
      });
      device.queue.writeBuffer(colorBuffer, 0, colors);

      let indexBuffer: any | null = null;
      if (indexData) {
        indexBuffer = device.createBuffer({
          size: indexData.byteLength,
          usage: usages.index | usages.copyDst,
        });
        device.queue.writeBuffer(indexBuffer, 0, indexData);
      }

      const uniformBuffer = device.createBuffer({
        size: UNIFORM_SIZE_BYTES,
        usage: usages.uniform | usages.copyDst,
      });

      const meshState: InternalMeshState = {
        id: nextMeshId++,
        geometry,
        model: new Float32Array(IDENTITY_MAT4),
        baseColor: new Float32Array([1, 1, 1, 1]),
        useVertexColor:
          material.useVertexColor != null ? (material.useVertexColor ? 1 : 0) : geometry.colors ? 1 : 0,
        positionBuffer,
        colorBuffer,
        indexBuffer,
        indexFormat,
        indexCount: indexData ? indexData.length : 0,
        vertexCount,
        uniformBuffer,
        bindGroup: device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        }),
        destroyed: false,
      };

      if (material.color) {
        const [r, g, b, a = 1] = material.color;
        meshState.baseColor.set([r, g, b, a]);
      }
      meshes.set(meshState.id, meshState);

      const meshApi: WebGPUMesh = {
        get id() {
          return meshState.id;
        },
        get geometry() {
          return meshState.geometry;
        },
        setTransform(transform: WebGPUMeshTransform) {
          if (transform.matrix) {
            meshState.model.set(transform.matrix);
            return;
          }
          const position = transform.position ?? [0, 0, 0];
          const rotation = transform.rotationEuler ?? [0, 0, 0];
          const scale = transform.scale ?? [1, 1, 1];
          meshState.model.set(composeTRS(position, rotation, scale));
        },
        setModelMatrix(matrix: Mat4) {
          meshState.model.set(matrix);
        },
        setColor(r: number, g: number, b: number, a = 1) {
          meshState.baseColor[0] = r;
          meshState.baseColor[1] = g;
          meshState.baseColor[2] = b;
          meshState.baseColor[3] = a;
        },
        setUseVertexColor(enabled: boolean) {
          meshState.useVertexColor = enabled ? 1 : 0;
        },
        destroy() {
          meshes.delete(meshState.id);
          destroyInternalMesh(meshState);
        },
      };

      return meshApi;
    },
    addMesh(mesh: WebGPUMesh) {
      // Meshes are auto-added by createMesh. This keeps a familiar API shape.
      if (!meshes.has(mesh.id)) {
        throw new Error('Mesh was not created by this renderer.');
      }
    },
    removeMesh(mesh: WebGPUMesh) {
      const state = meshes.get(mesh.id);
      if (!state) return;
      meshes.delete(mesh.id);
      destroyInternalMesh(state);
    },
    render() {
      if (destroyed) return;
      ensureCanvasPixelSize(canvas);
      context.configure({
        device,
        format: colorFormat,
        alphaMode: 'premultiplied',
      });
      ensureDepthTexture();
      const view = context.getCurrentTexture().createView();
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });
      pass.setPipeline(pipeline);
      for (const mesh of meshes.values()) {
        drawMesh(pass, mesh);
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const mesh of meshes.values()) {
        destroyInternalMesh(mesh);
      }
      meshes.clear();
      try {
        depthTexture?.destroy?.();
      } catch {
        // ignore
      }
      depthTexture = null;
      device.destroy();
    },
  };

  ensureDepthTexture();
  return scene;
}

export function createBoxGeometry(size = 1): WebGPUGeometryData {
  const s = size * 0.5;
  const positions = new Float32Array([
    -s, -s, -s, s, -s, -s, -s, s, -s, s, s, -s,
    -s, -s, s, s, -s, s, -s, s, s, s, s, s,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 2, 1, 3, 4, 6, 5, 5, 6, 7,
    0, 4, 1, 1, 4, 5, 2, 3, 6, 6, 3, 7,
    0, 2, 4, 4, 2, 6, 1, 5, 3, 3, 5, 7,
  ]);
  const colors = fillVertexColors(8, [1, 1, 1, 1]);
  return { positions, indices, colors };
}

export function createPlaneGeometry(width = 1, height = 1): WebGPUGeometryData {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const positions = new Float32Array([
    -hw, -hh, 0,
    hw, -hh, 0,
    hw, hh, 0,
    -hw, hh, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const colors = fillVertexColors(4, [1, 1, 1, 1]);
  return { positions, indices, colors };
}

export function mat4Identity(): Mat4 {
  return new Float32Array(IDENTITY_MAT4);
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  return multiplyMat4(a, b);
}

export function mat4Perspective(fovYRad: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * nf, -1,
    0, 0, far * near * nf, 0,
  ]);
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ]);
}

export function mat4FromTranslationRotationScale(
  position: Vec3 = [0, 0, 0],
  rotationEuler: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1]
): Mat4 {
  return composeTRS(position, rotationEuler, scale);
}

export function createViewProjectionMatrix(
  eye: Vec3,
  target: Vec3,
  options: {
    up?: Vec3;
    fovYRad?: number;
    aspect: number;
    near?: number;
    far?: number;
  }
): Mat4 {
  const view = mat4LookAt(eye, target, options.up ?? [0, 1, 0]);
  const projection = mat4Perspective(
    options.fovYRad ?? Math.PI / 3,
    options.aspect,
    options.near ?? 0.1,
    options.far ?? 100
  );
  return mat4Multiply(projection, view);
}

/**
 * Backward-compatible wrapper around the new scene renderer.
 * Returns a single cube mesh with legacy setters.
 */
export async function createWebGPU3DScene(
  canvas: HTMLCanvasElement,
  options: WebGPU3DSceneOptions = {}
): Promise<WebGPU3DScene | null> {
  const sceneRenderer = await createWebGPUSceneRenderer(canvas, {
    powerPreference: options.powerPreference,
    onDeviceLost: options.onDeviceLost,
    clearColor: options.clearColor,
  });
  if (!sceneRenderer) return null;

  const mesh = sceneRenderer.createMesh(createBoxGeometry(1), {
    color: [1, 1, 1, 1],
    useVertexColor: false,
  });

  const legacyScene: WebGPU3DScene = {
    get device() {
      return sceneRenderer.device;
    },
    get context() {
      return sceneRenderer.context;
    },
    get canvas() {
      return sceneRenderer.canvas;
    },
    setViewProjection(matrix: Mat4) {
      sceneRenderer.setViewProjection(matrix);
    },
    setModel(matrix: Mat4) {
      mesh.setModelMatrix(matrix);
    },
    setColor(r: number, g: number, b: number, a = 1) {
      mesh.setColor(r, g, b, a);
    },
    draw(_encoder: any, _pass: any) {
      // Legacy shim: prefer render() from this API surface.
      // This remains a no-op to avoid breaking existing call sites at compile-time.
      return;
    },
    render() {
      sceneRenderer.render();
    },
    destroy() {
      sceneRenderer.destroy();
    },
  };

  return legacyScene;
}

export type WebGPUTextureSource =
  | string
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | ImageBitmap
  | OffscreenCanvas;

export interface WebGPULitGeometryData extends WebGPUGeometryData {
  normals?: Float32Array;
  uvs?: Float32Array;
}

export interface WebGPULitMaterialOptions extends WebGPUMaterialOptions {
  useTexture?: boolean;
  texture?: WebGPUTextureSource;
  shininess?: number;
  specularStrength?: number;
}

export interface WebGPULitMesh extends WebGPUMesh {
  setShininess(value: number): void;
  setSpecularStrength(value: number): void;
  setTexture(source: WebGPUTextureSource | null): Promise<void>;
}

export interface WebGPULitSceneRendererOptions extends WebGPUSceneRendererOptions {
  ambientIntensity?: number;
}

export interface WebGPULitSceneRenderer extends WebGPUSceneRenderer {
  createMesh(geometry: WebGPULitGeometryData, material?: WebGPULitMaterialOptions): WebGPULitMesh;
  setLightDirection(x: number, y: number, z: number): void;
  setLightColor(r: number, g: number, b: number): void;
  setAmbientIntensity(value: number): void;
  setCameraPosition(x: number, y: number, z: number): void;
}

export interface WebGPUOrbitControlsOptions {
  target?: Vec3;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  azimuth?: number;
  polar?: number;
  minPolar?: number;
  maxPolar?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  damping?: number;
  fovYRad?: number;
  near?: number;
  far?: number;
}

export interface WebGPUOrbitControls {
  update(): void;
  dispose(): void;
  setTarget(target: Vec3): void;
  setDistance(distance: number): void;
}

const LIT_SCENE_WGSL = `
struct Uniforms {
  model: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  baseColor: vec4<f32>,
  lightDir: vec4<f32>,
  lightColorAndSpec: vec4<f32>,
  cameraAndAmbient: vec4<f32>,
  params: vec4<f32>,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var texColor: texture_2d<f32>;

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec4<f32>,
  @location(3) uv: vec2<f32>,
}

@vertex
fn vsMain(
  @location(0) pos: vec3<f32>,
  @location(1) color: vec4<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) uv: vec2<f32>
) -> VSOut {
  var out: VSOut;
  let wp = u.model * vec4<f32>(pos, 1.0);
  out.position = u.viewProjection * wp;
  out.worldPos = wp.xyz;
  out.normal = normalize((u.model * vec4<f32>(normal, 0.0)).xyz);
  out.color = color;
  out.uv = uv;
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  var albedo = u.baseColor;
  if (u.params.x > 0.5) {
    albedo = albedo * in.color;
  }
  if (u.params.y > 0.5) {
    albedo = albedo * textureSample(texColor, texSampler, in.uv);
  }

  let n = normalize(in.normal);
  let l = normalize(-u.lightDir.xyz);
  let v = normalize(u.cameraAndAmbient.xyz - in.worldPos);
  let h = normalize(l + v);

  let ambient = u.cameraAndAmbient.w;
  let diffuse = max(dot(n, l), 0.0);
  let specular = pow(max(dot(n, h), 0.0), max(u.params.z, 1.0)) * u.lightColorAndSpec.w;
  let lit = albedo.rgb * (ambient + diffuse * u.lightColorAndSpec.rgb) + vec3<f32>(specular);
  return vec4<f32>(lit, albedo.a);
}
`;

const LIT_UNIFORM_FLOATS = 52;
const LIT_UNIFORM_BYTES = LIT_UNIFORM_FLOATS * 4;

function ensureNormalsLit(positions: Float32Array, normals?: Float32Array): Float32Array {
  const vc = Math.floor(positions.length / 3);
  if (normals && normals.length === vc * 3) return normals;
  const out = new Float32Array(vc * 3);
  for (let i = 0; i < vc; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const len = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / len;
    out[i * 3 + 1] = y / len;
    out[i * 3 + 2] = z / len;
  }
  return out;
}

function ensureUvsLit(positions: Float32Array, uvs?: Float32Array): Float32Array {
  const vc = Math.floor(positions.length / 3);
  if (uvs && uvs.length === vc * 2) return uvs;
  return new Float32Array(vc * 2);
}

function getTextureUsagesLit(): { textureBinding: number; copyDst: number; renderAttachment: number } {
  const usage = (globalThis as any).GPUTextureUsage;
  return {
    textureBinding: usage.TEXTURE_BINDING,
    copyDst: usage.COPY_DST,
    renderAttachment: usage.RENDER_ATTACHMENT,
  };
}

function getTextureSourceSize(source: Exclude<WebGPUTextureSource, string>): { width: number; height: number } {
  const s = source as any;
  const width = s.videoWidth ?? s.naturalWidth ?? s.width ?? 1;
  const height = s.videoHeight ?? s.naturalHeight ?? s.height ?? 1;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

async function resolveTextureSource(source: WebGPUTextureSource): Promise<Exclude<WebGPUTextureSource, string>> {
  if (typeof source !== 'string') return source;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = source;
  if (typeof img.decode === 'function') await img.decode();
  return img;
}

function makeSolidTexture(device: any, rgba: [number, number, number, number]): { texture: any; view: any; sampler: any } {
  const usage = getTextureUsagesLit();
  const texture = device.createTexture({
    size: [1, 1, 1],
    format: 'rgba8unorm',
    usage: usage.textureBinding | usage.copyDst,
  });
  device.queue.writeTexture(
    { texture },
    new Uint8Array([
      Math.round(Math.max(0, Math.min(1, rgba[0])) * 255),
      Math.round(Math.max(0, Math.min(1, rgba[1])) * 255),
      Math.round(Math.max(0, Math.min(1, rgba[2])) * 255),
      Math.round(Math.max(0, Math.min(1, rgba[3])) * 255),
    ]),
    { bytesPerRow: 4 },
    [1, 1, 1]
  );
  return {
    texture,
    view: texture.createView(),
    sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
  };
}

export async function createWebGPUTextureFromSource(device: any, source: WebGPUTextureSource): Promise<{ texture: any; view: any; sampler: any }> {
  const resolved = await resolveTextureSource(source);
  const size = getTextureSourceSize(resolved);
  const usage = getTextureUsagesLit();
  const texture = device.createTexture({
    size: [size.width, size.height, 1],
    format: 'rgba8unorm',
    usage: usage.textureBinding | usage.copyDst | usage.renderAttachment,
  });
  device.queue.copyExternalImageToTexture({ source: resolved as any }, { texture }, [size.width, size.height]);
  return {
    texture,
    view: texture.createView(),
    sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
  };
}

export async function createWebGPULitSceneRenderer(
  canvas: HTMLCanvasElement,
  options: WebGPULitSceneRendererOptions = {}
): Promise<WebGPULitSceneRenderer | null> {
  const result = await requestWebGPUDevice({
    powerPreference: options.powerPreference,
    onDeviceLost: options.onDeviceLost,
  });
  if (!result) return null;
  const { device } = result;
  ensureCanvasPixelSize(canvas);
  const colorFormat = getGpuPreferredCanvasFormat();
  const context = configureWebGPUCanvas(canvas, device, { format: colorFormat });
  if (!context) return null;

  const clearColor = new Float32Array(options.clearColor ?? [0.1, 0.1, 0.15, 1]);
  const viewProjection = new Float32Array(IDENTITY_MAT4);
  const lightDirection = new Float32Array(normalize([-0.4, -1, -0.2]));
  const lightColor = new Float32Array([1, 1, 1]);
  const cameraPosition = new Float32Array([0, 0, 5]);
  let ambientIntensity = options.ambientIntensity ?? 0.2;

  type MeshState = {
    id: number;
    geometry: WebGPULitGeometryData;
    model: Mat4;
    baseColor: Float32Array;
    useVertexColor: number;
    useTexture: number;
    shininess: number;
    specularStrength: number;
    positionBuffer: any;
    colorBuffer: any;
    normalBuffer: any;
    uvBuffer: any;
    indexBuffer: any | null;
    indexFormat: 'uint16' | 'uint32' | null;
    indexCount: number;
    vertexCount: number;
    uniformBuffer: any;
    bindGroup: any;
    texture: { texture: any; view: any; sampler: any };
    ownsTexture: boolean;
    destroyed: boolean;
  };

  const usages = getBufferUsages();
  const meshes = new Map<number, MeshState>();
  let nextMeshId = 1;
  let destroyed = false;
  let depthTexture: any | null = null;
  const depthFormat = options.depthFormat ?? 'depth24plus';

  const shader = device.createShaderModule({ code: LIT_SCENE_WGSL });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'vsMain',
      buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }] },
        { arrayStride: 16, attributes: [{ shaderLocation: 1, format: 'float32x4', offset: 0 }] },
        { arrayStride: 12, attributes: [{ shaderLocation: 2, format: 'float32x3', offset: 0 }] },
        { arrayStride: 8, attributes: [{ shaderLocation: 3, format: 'float32x2', offset: 0 }] },
      ],
    },
    fragment: { module: shader, entryPoint: 'fsMain', targets: [{ format: colorFormat }] },
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
    depthStencil: { format: depthFormat, depthWriteEnabled: true, depthCompare: 'less' },
  });

  const whiteTexture = makeSolidTexture(device, [1, 1, 1, 1]);

  function ensureDepthTexture(): void {
    if (depthTexture && depthTexture.width === canvas.width && depthTexture.height === canvas.height) return;
    try {
      depthTexture?.destroy?.();
    } catch {
      // ignore
    }
    depthTexture = device.createTexture({
      size: [Math.max(1, canvas.width), Math.max(1, canvas.height), 1],
      format: depthFormat,
      usage: getTextureUsagesLit().renderAttachment,
    });
  }

  function createBindGroup(uniformBuffer: any, texture: { view: any; sampler: any }): any {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: texture.sampler },
        { binding: 2, resource: texture.view },
      ],
    });
  }

  function writeUniform(mesh: MeshState): void {
    const data = new Float32Array(LIT_UNIFORM_FLOATS);
    data.set(mesh.model, 0);
    data.set(viewProjection, 16);
    data.set(mesh.baseColor, 32);
    data[36] = lightDirection[0];
    data[37] = lightDirection[1];
    data[38] = lightDirection[2];
    data[40] = lightColor[0];
    data[41] = lightColor[1];
    data[42] = lightColor[2];
    data[43] = mesh.specularStrength;
    data[44] = cameraPosition[0];
    data[45] = cameraPosition[1];
    data[46] = cameraPosition[2];
    data[47] = ambientIntensity;
    data[48] = mesh.useVertexColor;
    data[49] = mesh.useTexture;
    data[50] = mesh.shininess;
    device.queue.writeBuffer(mesh.uniformBuffer, 0, data.buffer, data.byteOffset, LIT_UNIFORM_BYTES);
  }

  function destroyMesh(mesh: MeshState): void {
    if (mesh.destroyed) return;
    mesh.destroyed = true;
    mesh.positionBuffer.destroy();
    mesh.colorBuffer.destroy();
    mesh.normalBuffer.destroy();
    mesh.uvBuffer.destroy();
    mesh.uniformBuffer.destroy();
    mesh.indexBuffer?.destroy?.();
    if (mesh.ownsTexture) mesh.texture.texture.destroy();
  }

  const renderer: WebGPULitSceneRenderer = {
    get device() {
      return device;
    },
    get context() {
      return context;
    },
    get canvas() {
      return canvas;
    },
    get meshCount() {
      return meshes.size;
    },
    setClearColor(r: number, g: number, b: number, a = 1) {
      clearColor[0] = r;
      clearColor[1] = g;
      clearColor[2] = b;
      clearColor[3] = a;
    },
    setViewProjection(matrix: Mat4) {
      viewProjection.set(matrix);
    },
    setLightDirection(x: number, y: number, z: number) {
      const n = normalize([x, y, z]);
      lightDirection[0] = n[0];
      lightDirection[1] = n[1];
      lightDirection[2] = n[2];
    },
    setLightColor(r: number, g: number, b: number) {
      lightColor[0] = r;
      lightColor[1] = g;
      lightColor[2] = b;
    },
    setAmbientIntensity(value: number) {
      ambientIntensity = Math.max(0, value);
    },
    setCameraPosition(x: number, y: number, z: number) {
      cameraPosition[0] = x;
      cameraPosition[1] = y;
      cameraPosition[2] = z;
    },
    resize(width: number, height: number) {
      if (destroyed || !width || !height) return;
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
      context.configure({ device, format: colorFormat, alphaMode: 'premultiplied' });
      ensureDepthTexture();
    },
    createMesh(geometry: WebGPULitGeometryData, material: WebGPULitMaterialOptions = {}): WebGPULitMesh {
      const positions = geometry.positions;
      const colors = ensureColors(positions, geometry.colors);
      const normals = ensureNormalsLit(positions, geometry.normals);
      const uvs = ensureUvsLit(positions, geometry.uvs);
      const indexData = geometry.indices ?? null;
      const indexFormat: 'uint16' | 'uint32' | null = indexData instanceof Uint32Array ? 'uint32' : indexData ? 'uint16' : null;
      const vertexCount = Math.floor(positions.length / 3);

      const positionBuffer = device.createBuffer({ size: positions.byteLength, usage: usages.vertex | usages.copyDst });
      const colorBuffer = device.createBuffer({ size: colors.byteLength, usage: usages.vertex | usages.copyDst });
      const normalBuffer = device.createBuffer({ size: normals.byteLength, usage: usages.vertex | usages.copyDst });
      const uvBuffer = device.createBuffer({ size: uvs.byteLength, usage: usages.vertex | usages.copyDst });
      device.queue.writeBuffer(positionBuffer, 0, positions);
      device.queue.writeBuffer(colorBuffer, 0, colors);
      device.queue.writeBuffer(normalBuffer, 0, normals);
      device.queue.writeBuffer(uvBuffer, 0, uvs);

      let indexBuffer: any | null = null;
      if (indexData) {
        indexBuffer = device.createBuffer({ size: indexData.byteLength, usage: usages.index | usages.copyDst });
        device.queue.writeBuffer(indexBuffer, 0, indexData);
      }

      const uniformBuffer = device.createBuffer({ size: LIT_UNIFORM_BYTES, usage: usages.uniform | usages.copyDst });

      const state: MeshState = {
        id: nextMeshId++,
        geometry,
        model: new Float32Array(IDENTITY_MAT4),
        baseColor: new Float32Array([1, 1, 1, 1]),
        useVertexColor: material.useVertexColor != null ? (material.useVertexColor ? 1 : 0) : geometry.colors ? 1 : 0,
        useTexture: material.useTexture ? 1 : 0,
        shininess: material.shininess ?? 32,
        specularStrength: material.specularStrength ?? 0.35,
        positionBuffer,
        colorBuffer,
        normalBuffer,
        uvBuffer,
        indexBuffer,
        indexFormat,
        indexCount: indexData ? indexData.length : 0,
        vertexCount,
        uniformBuffer,
        bindGroup: undefined,
        texture: whiteTexture,
        ownsTexture: false,
        destroyed: false,
      };
      if (material.color) {
        const [r, g, b, a = 1] = material.color;
        state.baseColor.set([r, g, b, a]);
      }
      state.bindGroup = createBindGroup(uniformBuffer, state.texture);
      meshes.set(state.id, state);

      const mesh: WebGPULitMesh = {
        get id() {
          return state.id;
        },
        get geometry() {
          return state.geometry;
        },
        setTransform(transform: WebGPUMeshTransform) {
          if (transform.matrix) {
            state.model.set(transform.matrix);
            return;
          }
          state.model.set(
            composeTRS(transform.position ?? [0, 0, 0], transform.rotationEuler ?? [0, 0, 0], transform.scale ?? [1, 1, 1])
          );
        },
        setModelMatrix(matrix: Mat4) {
          state.model.set(matrix);
        },
        setColor(r: number, g: number, b: number, a = 1) {
          state.baseColor[0] = r;
          state.baseColor[1] = g;
          state.baseColor[2] = b;
          state.baseColor[3] = a;
        },
        setUseVertexColor(enabled: boolean) {
          state.useVertexColor = enabled ? 1 : 0;
        },
        setShininess(value: number) {
          state.shininess = Math.max(1, value);
        },
        setSpecularStrength(value: number) {
          state.specularStrength = Math.max(0, value);
        },
        async setTexture(source: WebGPUTextureSource | null) {
          if (source == null) {
            if (state.ownsTexture) state.texture.texture.destroy();
            state.texture = whiteTexture;
            state.ownsTexture = false;
            state.useTexture = 0;
            state.bindGroup = createBindGroup(state.uniformBuffer, state.texture);
            return;
          }
          const texture = await createWebGPUTextureFromSource(device, source);
          if (state.ownsTexture) state.texture.texture.destroy();
          state.texture = texture;
          state.ownsTexture = true;
          state.useTexture = 1;
          state.bindGroup = createBindGroup(state.uniformBuffer, state.texture);
        },
        destroy() {
          meshes.delete(state.id);
          destroyMesh(state);
        },
      };
      if (material.texture != null) {
        void mesh.setTexture(material.texture);
      }
      return mesh;
    },
    addMesh(mesh: WebGPUMesh) {
      if (!meshes.has(mesh.id)) throw new Error('Mesh was not created by this renderer.');
    },
    removeMesh(mesh: WebGPUMesh) {
      const state = meshes.get(mesh.id);
      if (!state) return;
      meshes.delete(mesh.id);
      destroyMesh(state);
    },
    render() {
      if (destroyed) return;
      ensureCanvasPixelSize(canvas);
      context.configure({ device, format: colorFormat, alphaMode: 'premultiplied' });
      ensureDepthTexture();
      const view = context.getCurrentTexture().createView();
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });
      pass.setPipeline(pipeline);
      for (const mesh of meshes.values()) {
        writeUniform(mesh);
        pass.setBindGroup(0, mesh.bindGroup);
        pass.setVertexBuffer(0, mesh.positionBuffer);
        pass.setVertexBuffer(1, mesh.colorBuffer);
        pass.setVertexBuffer(2, mesh.normalBuffer);
        pass.setVertexBuffer(3, mesh.uvBuffer);
        if (mesh.indexBuffer) {
          pass.setIndexBuffer(mesh.indexBuffer, mesh.indexFormat!);
          pass.drawIndexed(mesh.indexCount, 1, 0, 0, 0);
        } else {
          pass.draw(mesh.vertexCount, 1, 0, 0);
        }
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const mesh of meshes.values()) destroyMesh(mesh);
      meshes.clear();
      try {
        depthTexture?.destroy?.();
      } catch {
        // ignore
      }
      if (whiteTexture.texture) whiteTexture.texture.destroy();
      device.destroy();
    },
  };

  ensureDepthTexture();
  return renderer;
}

export function createWebGPUOrbitControls(
  canvas: HTMLCanvasElement,
  renderer: WebGPULitSceneRenderer,
  options: WebGPUOrbitControlsOptions = {}
): WebGPUOrbitControls {
  const target: Vec3 = [...(options.target ?? [0, 0, 0])] as Vec3;
  const minDistance = options.minDistance ?? 0.3;
  const maxDistance = options.maxDistance ?? 100;
  const minPolar = options.minPolar ?? 0.05;
  const maxPolar = options.maxPolar ?? Math.PI - 0.05;
  const rotateSpeed = options.rotateSpeed ?? 0.005;
  const zoomSpeed = options.zoomSpeed ?? 0.0015;
  const damping = Math.max(0, Math.min(1, options.damping ?? 0.15));
  let desiredDistance = Math.max(minDistance, Math.min(maxDistance, options.distance ?? 4));
  let desiredAzimuth = options.azimuth ?? 0.6;
  let desiredPolar = Math.max(minPolar, Math.min(maxPolar, options.polar ?? 1.1));
  let distance = desiredDistance;
  let azimuth = desiredAzimuth;
  let polar = desiredPolar;
  let dragging = false;
  let lx = 0;
  let ly = 0;

  function apply(): void {
    const sinP = Math.sin(polar);
    const eye: Vec3 = [
      target[0] + distance * sinP * Math.sin(azimuth),
      target[1] + distance * Math.cos(polar),
      target[2] + distance * sinP * Math.cos(azimuth),
    ];
    const aspect = Math.max(1e-6, canvas.width / Math.max(1, canvas.height));
    const vp = createViewProjectionMatrix(eye, target, {
      aspect,
      fovYRad: options.fovYRad ?? Math.PI / 3,
      near: options.near ?? 0.1,
      far: options.far ?? 100,
    });
    renderer.setCameraPosition(eye[0], eye[1], eye[2]);
    renderer.setViewProjection(vp);
  }

  function onDown(e: PointerEvent): void {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onMove(e: PointerEvent): void {
    if (!dragging) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    desiredAzimuth -= dx * rotateSpeed;
    desiredPolar = Math.max(minPolar, Math.min(maxPolar, desiredPolar + dy * rotateSpeed));
  }
  function onUp(e: PointerEvent): void {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  }
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    desiredDistance = Math.max(minDistance, Math.min(maxDistance, desiredDistance * (1 + e.deltaY * zoomSpeed)));
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const controls: WebGPUOrbitControls = {
    update() {
      azimuth += (desiredAzimuth - azimuth) * damping;
      polar += (desiredPolar - polar) * damping;
      distance += (desiredDistance - distance) * damping;
      apply();
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    },
    setTarget(next: Vec3) {
      target[0] = next[0];
      target[1] = next[1];
      target[2] = next[2];
    },
    setDistance(next: number) {
      desiredDistance = Math.max(minDistance, Math.min(maxDistance, next));
    },
  };

  controls.update();
  return controls;
}
