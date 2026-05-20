import { type FilterInstance, type RenderState, type ShaderFilterDefinition, type Texture } from '@rutan/midorable';
import { createWebGlPlatform } from '../../../../src';
import type { BrowserPlatformBase } from '../../../../src/BrowserPlatformBase';
import { createCanvasPlatform } from '../../../../src/canvas';
import { createWebGpuPlatform } from '../../../../src/webgpu';

type PlatformKind = 'canvas' | 'webgl' | 'webgpu';
type SmokeName = 'sprite' | 'mask' | 'filter' | 'mesh' | 'dispose';

interface SmokeResult {
  canvasAttached: boolean;
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

async function createPlatform(kind: PlatformKind): Promise<BrowserPlatformBase> {
  cleanup();

  const host = document.createElement('div');
  host.style.width = '64px';
  host.style.height = '64px';
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
  return {
    ...identityState,
    transform: { ...identityState.transform, tx: x, ty: y },
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
      cleanup(): void;
    };
  }
}

window.__midorableBrowserSmoke = {
  supports,
  run,
  cleanup,
};
