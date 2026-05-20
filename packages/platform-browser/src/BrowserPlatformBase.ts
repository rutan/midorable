import {
  Asset,
  AssetSpec,
  FilterInstance,
  LoadAssetOptions,
  MediaQuery,
  MediaSupportLevel,
  Platform,
  PlatformFeatureRegistry,
  RenderFilterCapabilities,
  ResolvedAsset,
  Renderer,
  ShaderFilterDefinition,
  Texture,
} from '@rutan/midorable';
import { BrowserAudioBackend } from './AudioBackend';
import { BrowserInput } from './BrowserInput';
import { BrowserResourceStore } from './BrowserResourceStore';
import { BrowserSurface } from './BrowserSurface';
import { registerDefaultPlatformFeatures } from './features';
import type { LogicalSize } from './types';
import { mediaQuery } from './utils';

export interface BrowserPlatformConfig {
  element: HTMLElement;
}

export abstract class BrowserPlatformBase implements Platform {
  private _surface: BrowserSurface | null = null;
  private _renderer: Renderer | null = null;
  private _audio: BrowserAudioBackend | null = null;
  private _input: BrowserInput | null = null;
  private _resources = new BrowserResourceStore();
  private _features: Partial<PlatformFeatureRegistry> = {};
  private _logicalSize: LogicalSize = { width: 0, height: 0 };
  private _loopCallback: ((now: number) => void) | null = null;
  private _rafId: number | null = null;
  private _disposeFunctions: (() => void)[] = [];

  protected _element: HTMLElement;

  constructor(config: BrowserPlatformConfig) {
    this._element = config.element;

    registerDefaultPlatformFeatures(this);
  }

  get renderer(): Renderer {
    if (!this._renderer) {
      throw new Error('Renderer is not initialized');
    }
    return this._renderer;
  }

  get audio(): BrowserAudioBackend {
    if (!this._audio) {
      throw new Error('Audio platform is not initialized');
    }
    return this._audio;
  }

  get input(): BrowserInput {
    if (!this._input) {
      throw new Error('Input platform is not initialized');
    }
    return this._input;
  }

  get surface(): BrowserSurface {
    if (!this._surface) {
      throw new Error('Surface is not initialized');
    }
    return this._surface;
  }

  get canvas(): HTMLCanvasElement {
    return this.surface.canvas;
  }

  get element(): HTMLElement {
    return this._element;
  }

  get logicalSize(): LogicalSize {
    return this._logicalSize;
  }

  get filterCapabilities(): RenderFilterCapabilities | null {
    return null;
  }

  async init() {
    if (this._surface) {
      return;
    }

    const surface = new BrowserSurface(this._element);
    const input = new BrowserInput(this._element);
    const audio = new BrowserAudioBackend({ element: this._element });
    const renderer = await this.createRenderer(surface.canvas);

    surface.observeViewport((viewport) => {
      input.setViewport(viewport);
    });

    this._surface = surface;
    this._input = input;
    this._audio = audio;
    this._renderer = renderer;

    if (this._logicalSize.width > 0 && this._logicalSize.height > 0) {
      this.applyLogicalSize(this._logicalSize.width, this._logicalSize.height);
    }
  }

  dispose() {
    this.stopLoop();

    for (const dispose of this._disposeFunctions) {
      try {
        dispose();
      } catch (error) {
        console.error('Failed to dispose default feature:', error);
      }
    }
    this._disposeFunctions = [];

    this._renderer?.resize(0, 0);
    this.disposeRenderer(this._renderer);
    this._renderer = null;

    this._input?.dispose();
    this._input = null;

    this._audio?.dispose();
    this._audio = null;

    this._surface?.dispose();
    this._surface = null;

    this._resources.clear();
    this.clearFeatures();
  }

  startLoop(callback: (now: number) => void) {
    this._loopCallback = callback;
    if (this._rafId !== null) {
      return;
    }

    const tick = (now: number) => {
      if (!this._loopCallback) {
        this._rafId = null;
        return;
      }
      this._loopCallback(now);
      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    this._loopCallback = null;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  resize(width: number, height: number) {
    this._logicalSize = { width, height };
    if (!this._surface || !this._renderer) {
      return;
    }
    this.applyLogicalSize(width, height);
  }

  async loadAsset<TSpec extends AssetSpec>(spec: TSpec, options?: LoadAssetOptions): Promise<ResolvedAsset<TSpec>> {
    switch (spec.type) {
      case 'image':
        return this._resources.loadImage(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
      case 'audio':
        if (!this._audio) {
          throw new Error('Audio platform is not initialized');
        }
        return this._resources.loadAudio(
          spec.src,
          (targetUrl, signal) => this._audio!.loadAudio(targetUrl, signal),
          options?.signal,
        ) as Promise<ResolvedAsset<TSpec>>;
      case 'text':
        return this._resources.loadText(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
      case 'binary':
        return this._resources.loadBinary(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
    }
  }

  unloadAsset(asset: Asset) {
    const released = this._resources.unload(asset);
    if (released) {
      this.onUnloadAsset(asset);
    }
  }

  getFeature<K extends keyof PlatformFeatureRegistry>(key: K): PlatformFeatureRegistry[K] | undefined {
    return this._features[key] as PlatformFeatureRegistry[K] | undefined;
  }

  setCursor(cursor: string | null) {
    this._element.style.cursor = cursor ?? 'default';
  }

  mediaQuery(query: MediaQuery): MediaSupportLevel {
    return mediaQuery(query);
  }

  createTexture(width: number, height: number): Texture {
    return this.createTextureCore(width, height);
  }

  async createFilter(_definition: ShaderFilterDefinition): Promise<FilterInstance> {
    throw new Error('Shader filters are not supported on this platform');
  }

  protected applyLogicalSize(width: number, height: number) {
    this.surface.setLogicalSize(width, height);
    this.onResize(width, height);
    this.renderer.resize(width, height);
  }

  protected onUnloadAsset(_asset: Asset) {
    // noop
  }

  setFeature<K extends keyof PlatformFeatureRegistry>(key: K, feature: PlatformFeatureRegistry[K]) {
    this._features[key] = feature;
  }

  protected clearFeatures() {
    this._features = {};
  }

  addDisposeFunction(dispose: () => void) {
    this._disposeFunctions.push(dispose);
  }

  protected abstract createRenderer(canvas: HTMLCanvasElement): Promise<Renderer>;
  protected abstract disposeRenderer(renderer: Renderer | null): void;
  protected abstract onResize(width: number, height: number): void;
  protected abstract createTextureCore(width: number, height: number): Texture;
}
