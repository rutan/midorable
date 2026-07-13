import {
  AssetsBackend,
  AudioBackend,
  AssetSpec,
  GraphicsBackend,
  HostBackend,
  LoadAssetOptions,
  ResolvedAsset,
  InputBackend,
  MediaQuery,
  MediaSupportLevel,
  Platform,
  PlatformFeatureRegistry,
} from '@rutan/midorable/platform';
import { HeadlessAudioBackend } from './HeadlessAudioBackend';
import { HeadlessInput } from './HeadlessInput';
import { HeadlessRenderer } from './HeadlessRenderer';
import { HeadlessResourceStore } from './HeadlessResourceStore';
import { HeadlessTexture } from './HeadlessTexture';
import { HeadlessPlatformConfig } from './types';

type CancelLoop = () => void;

export class HeadlessPlatform implements Platform {
  readonly host: HostBackend;
  readonly graphics: GraphicsBackend & { readonly renderer: HeadlessRenderer };
  readonly audio: AudioBackend;
  readonly input: InputBackend;
  readonly assets: AssetsBackend;

  private _features: Partial<PlatformFeatureRegistry> = {};
  private _resources: HeadlessResourceStore;
  private _now: () => number;
  private _schedule: (callback: (now: number) => void) => CancelLoop;
  private _loopCancel: CancelLoop | null = null;
  private _loopCallback: ((now: number) => void) | null = null;
  private _width = 0;
  private _height = 0;
  private _rendererMode: 'noop' | 'record';
  private _cursor: string | null = null;
  private _mediaQuery?: (query: MediaQuery) => MediaSupportLevel;

  constructor(config: HeadlessPlatformConfig = {}) {
    this._rendererMode = config.rendererMode ?? 'noop';
    const renderer = new HeadlessRenderer(this._rendererMode);
    this.audio = new HeadlessAudioBackend();
    this.input = new HeadlessInput();
    this._resources = new HeadlessResourceStore(config.resource);
    this._now = config.now ?? resolveNow;
    this._schedule = config.schedule ?? ((callback) => createTimeoutScheduler(callback, this._now));
    this._mediaQuery = config.mediaQuery;
    this._width = config.width ?? 0;
    this._height = config.height ?? 0;
    renderer.resize(this._width, this._height);
    this.host = {
      startLoop: (callback) => this.startLoop(callback),
      stopLoop: () => this.stopLoop(),
      resize: (width, height) => this.resize(width, height),
      setCursor: (cursor) => {
        this._cursor = cursor;
      },
    };
    this.graphics = {
      renderer,
      capabilities: {},
      createTexture: (width, height) =>
        new HeadlessTexture(width, height, { recording: this._rendererMode === 'record' }),
      createFilter: async (_definition) => {
        throw new Error('Shader filters are not supported on headless platform');
      },
    };
    this.assets = {
      load: (spec, options) => this.loadAsset(spec, options),
      unload: (asset) => this._resources.unload(asset),
      mediaQuery: (query) => this.mediaQuery(query),
    };
    this.setFeature('headless', { rendererMode: this._rendererMode });
    this.setFeature('renderer.mesh', renderer);
    this.setFeature('system.locale', {
      getLocale() {
        return resolveLocale();
      },
      getTimeZone() {
        return resolveTimeZone();
      },
    });
  }

  dispose(): void {
    this.host.stopLoop();
    this.audio.dispose();
    this.input.dispose();
    this._resources.clear();
    this.clearFeatures();
  }

  private startLoop(callback: (now: number) => void): void {
    this._loopCallback = callback;
    if (this._loopCancel) {
      return;
    }

    const tick = (now: number) => {
      if (!this._loopCallback) {
        this._loopCancel = null;
        return;
      }
      this._loopCallback(now);
      if (!this._loopCallback) {
        this._loopCancel = null;
        return;
      }
      this._loopCancel = this._schedule(tick);
    };

    this._loopCancel = this._schedule(tick);
  }

  private stopLoop(): void {
    this._loopCallback = null;
    if (this._loopCancel) {
      this._loopCancel();
      this._loopCancel = null;
    }
  }

  private resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this.graphics.renderer.resize(width, height);
  }

  private async loadAsset<TSpec extends AssetSpec>(
    spec: TSpec,
    options?: LoadAssetOptions,
  ): Promise<ResolvedAsset<TSpec>> {
    switch (spec.type) {
      case 'image':
        return this._resources.loadImage(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
      case 'audio':
        return this._resources.loadAudio(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
      case 'text':
        return this._resources.loadText(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
      case 'binary':
        return this._resources.loadBinary(spec.src, options?.signal) as Promise<ResolvedAsset<TSpec>>;
    }
  }

  getFeature<K extends keyof PlatformFeatureRegistry>(key: K): PlatformFeatureRegistry[K] | undefined {
    return this._features[key] as PlatformFeatureRegistry[K] | undefined;
  }

  private mediaQuery(query: MediaQuery): MediaSupportLevel {
    if (this._mediaQuery) {
      return this._mediaQuery(query);
    }
    return 'unknown';
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get cursor(): string | null {
    return this._cursor;
  }

  private setFeature<K extends keyof PlatformFeatureRegistry>(key: K, feature: PlatformFeatureRegistry[K]): void {
    this._features[key] = feature;
  }

  private clearFeatures(): void {
    this._features = {};
  }
}

function createTimeoutScheduler(callback: (now: number) => void, now: () => number): CancelLoop {
  const timer = setTimeout(() => {
    callback(now());
  }, 16);
  return () => clearTimeout(timer);
}

function resolveNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function resolveLocale(): string {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return 'en-US';
  }

  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale || 'en-US';
}

function resolveTimeZone(): string {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return 'UTC';
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone || 'UTC';
}
