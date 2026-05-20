import {
  Asset,
  FilterInstance,
  RenderFilterCapabilities,
  Renderer,
  ShaderFilterDefinition,
  Texture,
} from '@rutan/midorable';
import { BrowserPlatformBase, BrowserPlatformConfig } from '../BrowserPlatformBase';
import { CanvasBackedTexture } from '../internal/CanvasBackedTexture';
import { WebGlRenderer } from './WebGlRenderer';

export interface WebGlPlatformConfig extends BrowserPlatformConfig {}

export class WebGlPlatform extends BrowserPlatformBase {
  private static readonly FILTER_CAPABILITIES: RenderFilterCapabilities = {
    shaderLanguages: ['glsl-es-300'],
  };
  private _gl: WebGL2RenderingContext | null = null;
  private _webglRenderer: WebGlRenderer | null = null;
  private _detachContextEvents: (() => void) | null = null;

  get gl(): WebGL2RenderingContext | null {
    return this._gl;
  }

  get filterCapabilities(): RenderFilterCapabilities | null {
    return WebGlPlatform.FILTER_CAPABILITIES;
  }

  protected async createRenderer(canvas: HTMLCanvasElement): Promise<Renderer> {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    }) as WebGL2RenderingContext | null;
    if (!gl) {
      throw new Error('WebGL2 is not supported in this environment');
    }

    this._gl = gl;
    this._webglRenderer = new WebGlRenderer(canvas, gl);
    this.setFeature('renderer.mesh', this._webglRenderer);
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      this._webglRenderer?.onContextLost();
      console.warn('WebGL context lost');
    };
    const handleContextRestored = () => {
      this._webglRenderer?.onContextRestored();
      console.warn('WebGL context restored');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    this._detachContextEvents = () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
    return this._webglRenderer;
  }

  protected disposeRenderer(renderer: Renderer | null): void {
    this._detachContextEvents?.();
    this._detachContextEvents = null;
    if (renderer instanceof WebGlRenderer) {
      renderer.dispose();
    }
    this._webglRenderer = null;
    this._gl = null;
  }

  protected onResize(_width: number, _height: number): void {}

  protected createTextureCore(width: number, height: number): Texture {
    return new CanvasBackedTexture(width, height);
  }

  protected onUnloadAsset(asset: Asset): void {
    if (asset.type !== 'image' || !('source' in asset)) {
      return;
    }
    const source = asset.source;
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      this._webglRenderer?.releaseTextureSource(source);
    }
  }

  async createFilter(definition: ShaderFilterDefinition): Promise<FilterInstance> {
    const renderer = this._webglRenderer;
    if (!renderer) {
      throw new Error('WebGL renderer is not initialized');
    }
    return renderer.createFilter(definition);
  }
}
