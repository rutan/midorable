import { type FilterInstance, type RenderState, type ShaderFilterDefinition, type Texture } from '@rutan/midorable';
import { createWebGlPlatform } from '../../../../src';
import type { BrowserPlatformBase } from '../../../../src/BrowserPlatformBase';
import { createCanvasPlatform } from '../../../../src/canvas';
import { createWebGpuPlatform } from '../../../../src/webgpu';

type PlatformKind = 'canvas' | 'webgl' | 'webgpu';
type SmokeName = 'sprite' | 'mask' | 'filter' | 'mesh' | 'dispose';
type BenchmarkName = 'sprites' | 'mask' | 'filter' | 'nine-patch' | 'mesh';

interface SmokeResult {
  canvasAttached: boolean;
}

interface BrowserBenchmarkResult {
  name: BenchmarkName;
  kind: PlatformKind;
  frames: number;
  iterations: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

let activePlatform: BrowserPlatformBase | null = null;
let activeDisposables: Array<FilterInstance | Texture> = [];

const identityState: RenderState = {
  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
  alpha: 1,
  blendMode: 'normal',
  colorTone: { r: 0, g: 0, b: 0, a: 0 },
  smooth: false,
};

async function createPlatform(kind: PlatformKind, size = 64): Promise<BrowserPlatformBase> {
  cleanup();

  const host = document.createElement('div');
  host.style.width = `${size}px`;
  host.style.height = `${size}px`;
  document.body.append(host);

  switch (kind) {
    case 'canvas':
      return createCanvasPlatform({ element: host });
    case 'webgl':
      return createWebGlPlatform({ element: host });
    case 'webgpu':
      return createWebGpuPlatform({ element: host });
  }
}

function translatedState(x: number, y: number): RenderState {
  return transformedState(x, y, 1, 1);
}

function transformedState(x: number, y: number, scaleX: number, scaleY: number): RenderState {
  return {
    ...identityState,
    transform: { a: scaleX, b: 0, c: 0, d: scaleY, tx: x, ty: y },
  };
}

function drawSolidTexture(platform: BrowserPlatformBase, width: number, height: number, color: string) {
  const texture = platform.createTexture(width, height);
  const rgba = parseHexColor(color);
  texture.drawRect({ x: 0, y: 0, width, height, color: rgba });
  activeDisposables.push(texture);
  return texture;
}

async function runSpriteSmoke(kind: PlatformKind): Promise<SmokeResult> {
  const platform = await createPlatform(kind);
  activePlatform = platform;
  platform.resize(64, 64);
  const texture = drawSolidTexture(platform, 16, 16, '#00ff00');

  platform.renderer.beginFrame();
  platform.renderer.clear({ r: 255, g: 0, b: 0, a: 1 });
  platform.renderer.drawSprite(texture, translatedState(8, 8));
  platform.renderer.endFrame();

  await nextPaint();
  const canvasAttached = platform.canvas.parentElement === platform.element;
  return { canvasAttached };
}

async function runMaskSmoke(kind: PlatformKind): Promise<SmokeResult> {
  const platform = await createPlatform(kind);
  activePlatform = platform;
  platform.resize(64, 64);
  const content = drawSolidTexture(platform, 48, 48, '#00ff00');
  const mask = drawSolidTexture(platform, 16, 16, '#ffffff');

  platform.renderer.beginFrame();
  platform.renderer.clear({ r: 0, g: 0, b: 0, a: 1 });
  platform.renderer.pushMask();
  platform.renderer.drawSprite(content, translatedState(8, 8));
  platform.renderer.activateMask();
  platform.renderer.drawSprite(mask, translatedState(24, 24));
  platform.renderer.popMask();
  platform.renderer.endFrame();

  await nextPaint();
  const canvasAttached = platform.canvas.parentElement === platform.element;
  return { canvasAttached };
}

async function runFilterSmoke(kind: PlatformKind): Promise<SmokeResult> {
  const platform = await createPlatform(kind);
  activePlatform = platform;
  platform.resize(64, 64);
  const texture = drawSolidTexture(platform, 16, 16, '#00ff00');
  const filter = await platform.createFilter(createRedFilterDefinition(kind));
  activeDisposables.push(filter);

  platform.renderer.beginFrame();
  platform.renderer.clear({ r: 0, g: 0, b: 0, a: 1 });
  if (platform.renderer.pushFilters([filter], translatedState(8, 8))) {
    platform.renderer.drawSprite(texture, translatedState(8, 8));
    platform.renderer.popFilters();
  }
  platform.renderer.endFrame();

  await nextPaint();
  const canvasAttached = platform.canvas.parentElement === platform.element;
  return { canvasAttached };
}

async function runMeshSmoke(kind: PlatformKind): Promise<SmokeResult> {
  const platform = await createPlatform(kind);
  activePlatform = platform;
  platform.resize(64, 64);
  const texture = drawSolidTexture(platform, 16, 16, '#00ff00');
  const mesh = platform.getFeature('renderer.mesh');
  if (!mesh) {
    throw new Error('renderer.mesh is not supported');
  }

  platform.renderer.beginFrame();
  platform.renderer.clear({ r: 255, g: 0, b: 0, a: 1 });
  mesh.drawTexturedTriangles({
    image: texture,
    state: identityState,
    positions: [8, 8, 56, 8, 8, 56],
    uvs: [0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
  });
  platform.renderer.endFrame();

  await nextPaint();
  const canvasAttached = platform.canvas.parentElement === platform.element;
  return { canvasAttached };
}

async function runDisposeSmoke(kind: PlatformKind): Promise<SmokeResult> {
  const platform = await createPlatform(kind);
  platform.resize(64, 64);
  const canvas = platform.canvas;
  platform.dispose();
  platform.element.remove();
  return {
    canvasAttached: canvas.parentElement === platform.element,
  };
}

async function runSpriteBenchmark(kind: PlatformKind): Promise<BrowserBenchmarkResult> {
  return runRendererBenchmark(kind, 'sprites', 400, (platform, texture, frame, size, count) => {
    for (let index = 0; index < count; index += 1) {
      const x = (index * 13 + frame) % size;
      const y = (index * 17 + frame * 2) % size;
      platform.renderer.drawSprite(texture, translatedState(x, y));
    }
  });
}

async function runMaskBenchmark(kind: PlatformKind): Promise<BrowserBenchmarkResult> {
  return runRendererBenchmark(kind, 'mask', 120, (platform, texture, frame, size, count) => {
    for (let index = 0; index < count; index += 1) {
      const x = (index * 13 + frame) % size;
      const y = (index * 17 + frame * 2) % size;
      platform.renderer.pushMask();
      platform.renderer.drawSprite(texture, transformedState(x, y, 2, 2));
      platform.renderer.activateMask();
      platform.renderer.drawSprite(texture, translatedState(x + 4, y + 4));
      platform.renderer.popMask();
    }
  });
}

async function runFilterBenchmark(kind: PlatformKind): Promise<BrowserBenchmarkResult> {
  return runRendererBenchmark(
    kind,
    'filter',
    80,
    (platform, texture, frame, size, count, filter) => {
      if (!filter) {
        throw new Error('filter benchmark requires a filter');
      }
      for (let index = 0; index < count; index += 1) {
        const x = (index * 19 + frame) % size;
        const y = (index * 23 + frame * 2) % size;
        if (platform.renderer.pushFilters([filter], translatedState(x, y))) {
          platform.renderer.drawSprite(texture, translatedState(x, y));
          platform.renderer.popFilters();
        }
      }
    },
    { createFilter: true },
  );
}

async function runNinePatchBenchmark(kind: PlatformKind): Promise<BrowserBenchmarkResult> {
  const frames = [
    { x: 0, y: 0, width: 8, height: 8 },
    { x: 8, y: 0, width: 16, height: 8 },
    { x: 24, y: 0, width: 8, height: 8 },
    { x: 0, y: 8, width: 8, height: 16 },
    { x: 8, y: 8, width: 16, height: 16 },
    { x: 24, y: 8, width: 8, height: 16 },
    { x: 0, y: 24, width: 8, height: 8 },
    { x: 8, y: 24, width: 16, height: 8 },
    { x: 24, y: 24, width: 8, height: 8 },
  ];
  return runRendererBenchmark(kind, 'nine-patch', 80, (platform, texture, frame, size, count) => {
    for (let index = 0; index < count; index += 1) {
      const x = (index * 17 + frame) % size;
      const y = (index * 11 + frame * 2) % size;
      const width = 48 + (index % 4) * 8;
      const height = 32 + (index % 3) * 8;
      drawNinePatch(platform, texture, frames, x, y, width, height);
    }
  });
}

async function runMeshBenchmark(kind: PlatformKind): Promise<BrowserBenchmarkResult> {
  return runRendererBenchmark(kind, 'mesh', 200, (platform, texture, frame, size, count) => {
    const mesh = platform.getFeature('renderer.mesh');
    if (!mesh) {
      throw new Error('renderer.mesh is not supported');
    }
    for (let index = 0; index < count; index += 1) {
      const x = (index * 13 + frame) % size;
      const y = (index * 17 + frame * 2) % size;
      mesh.drawTexturedTriangles({
        image: texture,
        state: identityState,
        positions: [x, y, x + 16, y, x, y + 16],
        uvs: [0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      });
    }
  });
}

async function runRendererBenchmark(
  kind: PlatformKind,
  name: BenchmarkName,
  iterations: number,
  draw: (
    platform: BrowserPlatformBase,
    texture: Texture,
    frame: number,
    size: number,
    count: number,
    filter?: FilterInstance,
  ) => void,
  options: { createFilter?: boolean } = {},
): Promise<BrowserBenchmarkResult> {
  const frames = 120;
  const warmupFrames = 20;
  const size = 256;
  const platform = await createPlatform(kind, size);
  activePlatform = platform;
  platform.resize(size, size);
  const texture = drawSolidTexture(platform, 32, 32, '#00ff00');
  const filter = options.createFilter ? await platform.createFilter(createRedFilterDefinition(kind)) : undefined;
  if (filter) {
    activeDisposables.push(filter);
  }
  const durations: number[] = [];

  for (let frame = 0; frame < warmupFrames + frames; frame += 1) {
    await nextAnimationFrame();
    const startedAt = performance.now();
    platform.renderer.beginFrame();
    platform.renderer.clear({ r: 0, g: 0, b: 0, a: 1 });
    draw(platform, texture, frame, size, iterations, filter);
    platform.renderer.endFrame();
    const duration = performance.now() - startedAt;
    if (frame >= warmupFrames) {
      durations.push(duration);
    }
  }

  await nextPaint();
  return {
    name,
    kind,
    frames,
    iterations,
    meanMs: mean(durations),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
  };
}

function drawNinePatch(
  platform: BrowserPlatformBase,
  texture: Texture,
  frames: Array<{ x: number; y: number; width: number; height: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const dst = [
    [x, y, 8, 8],
    [x + 8, y, width - 16, 8],
    [x + width - 8, y, 8, 8],
    [x, y + 8, 8, height - 16],
    [x + 8, y + 8, width - 16, height - 16],
    [x + width - 8, y + 8, 8, height - 16],
    [x, y + height - 8, 8, 8],
    [x + 8, y + height - 8, width - 16, 8],
    [x + width - 8, y + height - 8, 8, 8],
  ];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    const [dx, dy, dw, dh] = dst[index]!;
    platform.renderer.drawSprite(texture, transformedState(dx, dy, dw / frame.width, dh / frame.height), frame);
  }
}

function createRedFilterDefinition(kind: PlatformKind): ShaderFilterDefinition {
  if (kind === 'webgpu') {
    return {
      language: 'wgsl',
      fragment: `
fn applyFilter(color: vec4<f32>, uv: vec2<f32>, uniforms: array<vec4<f32>, 16>) -> vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, color.a);
}
      `,
    };
  }

  return {
    language: 'glsl-es-300',
    fragment: `
vec4 applyFilter(vec4 color, vec2 uv, vec4 uniforms[16]) {
  return vec4(1.0, 0.0, 0.0, color.a);
}
    `,
  };
}

function parseHexColor(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
    a: 1,
  };
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index] ?? 0;
}

async function supports(kind: PlatformKind): Promise<boolean> {
  if (kind === 'canvas') {
    return true;
  }
  const canvas = document.createElement('canvas');
  if (kind === 'webgl') {
    return Boolean(canvas.getContext('webgl2'));
  }
  if (!navigator.gpu) {
    return false;
  }
  const adapter = await navigator.gpu.requestAdapter();
  return Boolean(adapter && canvas.getContext('webgpu'));
}

async function run(kind: PlatformKind, name: SmokeName): Promise<SmokeResult> {
  switch (name) {
    case 'sprite':
      return runSpriteSmoke(kind);
    case 'mask':
      return runMaskSmoke(kind);
    case 'filter':
      return runFilterSmoke(kind);
    case 'mesh':
      return runMeshSmoke(kind);
    case 'dispose':
      return runDisposeSmoke(kind);
  }
}

async function benchmark(kind: PlatformKind, name: BenchmarkName): Promise<BrowserBenchmarkResult> {
  switch (name) {
    case 'sprites':
      return runSpriteBenchmark(kind);
    case 'mask':
      return runMaskBenchmark(kind);
    case 'filter':
      return runFilterBenchmark(kind);
    case 'nine-patch':
      return runNinePatchBenchmark(kind);
    case 'mesh':
      return runMeshBenchmark(kind);
  }
}

function cleanup() {
  for (const disposable of activeDisposables) {
    disposable.dispose();
  }
  activeDisposables = [];

  if (activePlatform) {
    const element = activePlatform.element;
    activePlatform.dispose();
    element.remove();
    activePlatform = null;
  }
}

declare global {
  interface Window {
    __midorableBrowserSmoke: {
      supports(kind: PlatformKind): Promise<boolean>;
      run(kind: PlatformKind, name: SmokeName): Promise<SmokeResult>;
      benchmark(kind: PlatformKind, name: BenchmarkName): Promise<BrowserBenchmarkResult>;
      cleanup(): void;
    };
  }
}

window.__midorableBrowserSmoke = {
  supports,
  run,
  benchmark,
  cleanup,
};
