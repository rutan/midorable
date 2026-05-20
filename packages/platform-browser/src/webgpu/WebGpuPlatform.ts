import {
  Asset,
  FilterInstance,
  ImageAsset,
  RenderFilterCapabilities,
  Renderer,
  ShaderFilterDefinition,
  Texture,
} from '@rutan/midorable';
import { BrowserPlatformBase, BrowserPlatformConfig } from '../BrowserPlatformBase';
import { WebGpuRenderer } from './WebGpuRenderer';
import { WebGpuTexture } from './WebGpuTexture';

export interface WebGpuPlatformConfig extends BrowserPlatformConfig {}

export class WebGpuPlatform extends BrowserPlatformBase {
  private static readonly FILTER_CAPABILITIES: RenderFilterCapabilities = {
    shaderLanguages: ['wgsl'],
  };
  private _context: GPUCanvasContext | null = null;
  private _device: GPUDevice | null = null;
  private _format: GPUTextureFormat | null = null;
  private _webgpuRenderer: WebGpuRenderer | null = null;

  get device() {
    return this._device;
  }

  get context() {
    return this._context;
  }

  get format() {
    return this._format;
  }

  get filterCapabilities(): RenderFilterCapabilities | null {
    return WebGpuPlatform.FILTER_CAPABILITIES;
  }

  protected async createRenderer(canvas: HTMLCanvasElement): Promise<Renderer> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this environment');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter');
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      throw new Error('Failed to get WebGPU canvas context');
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    this.configureContext(context, device, format);

    this._device = device;
    this._context = context;
    this._format = format;
    this._webgpuRenderer = new WebGpuRenderer(this);
    return this._webgpuRenderer;
  }

  protected disposeRenderer(renderer: Renderer | null): void {
    if (renderer instanceof WebGpuRenderer) {
      renderer.dispose();
    }
    this._webgpuRenderer = null;
    this._context = null;
    this._device = null;
    this._format = null;
  }

  protected onResize(width: number, height: number): void {
    const canvas = this.canvas;
    canvas.width = width;
    canvas.height = height;

    if (this._context && this._device && this._format) {
      this.configureContext(this._context, this._device, this._format);
    }
  }

  protected createTextureCore(width: number, height: number): Texture {
    if (!this._device) {
      throw new Error('WebGpuPlatform is not initialized');
    }
    return new WebGpuTexture(this._device, width, height);
  }

  protected onUnloadAsset(asset: Asset) {
    if (asset.type !== 'image') {
      return;
    }
    const image = asset as ImageAsset;
    this._webgpuRenderer?.releaseExternalTexture(image.source);
  }

  async createFilter(definition: ShaderFilterDefinition): Promise<FilterInstance> {
    const renderer = this._webgpuRenderer;
    if (!renderer) {
      throw new Error('WebGPU renderer is not initialized');
    }
    return renderer.createFilter(definition);
  }

  private configureContext(context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat) {
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });
  }
}
