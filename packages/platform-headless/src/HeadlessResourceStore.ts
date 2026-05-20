import { Asset, AudioAsset, BinaryAsset, ImageAsset, TextAsset } from '@rutan/midorable';
import { HeadlessLoadedAssetSet, HeadlessResourceConfig } from './types';

export class HeadlessResourceStore {
  private _images = new Map<string, Promise<ImageAsset>>();
  private _audios = new Map<string, Promise<AudioAsset>>();
  private _texts = new Map<string, Promise<TextAsset>>();
  private _binaries = new Map<string, Promise<BinaryAsset>>();
  private _imageRefs = new Map<string, number>();
  private _audioRefs = new Map<string, number>();
  private _textRefs = new Map<string, number>();
  private _binaryRefs = new Map<string, number>();

  private _config: HeadlessResourceConfig;
  private _fetch?: (url: string, options?: { signal?: AbortSignal }) => Promise<Response>;

  constructor(config?: HeadlessResourceConfig) {
    this._config = config ?? {};
    this._fetch = config?.fetch ?? resolveGlobalFetch();
  }

  get loaded(): HeadlessLoadedAssetSet {
    return {
      image: this._images,
      audio: this._audios,
      text: this._texts,
      binary: this._binaries,
    };
  }

  async loadImage(url: string, signal?: AbortSignal): Promise<ImageAsset> {
    const cached = this._images.get(url);
    if (cached) {
      this._retain(this._imageRefs, url);
      return cached.then(cloneImageAsset);
    }
    const pending = (async () => {
      const loader = this._config.loadImage;
      if (!loader) {
        throw new Error('Image loading is not configured for HeadlessPlatform');
      }
      return loader(url, { signal });
    })().catch((error) => {
      this._images.delete(url);
      this._imageRefs.delete(url);
      throw error;
    });
    this._images.set(url, pending);
    this._imageRefs.set(url, 1);
    return pending.then(cloneImageAsset);
  }

  async loadAudio(url: string, signal?: AbortSignal): Promise<AudioAsset> {
    const cached = this._audios.get(url);
    if (cached) {
      this._retain(this._audioRefs, url);
      return cached.then(cloneAudioAsset);
    }
    const pending = (async () => {
      const loader = this._config.loadAudio;
      if (!loader) {
        throw new Error('Audio loading is not configured for HeadlessPlatform');
      }
      return loader(url, { signal });
    })().catch((error) => {
      this._audios.delete(url);
      this._audioRefs.delete(url);
      throw error;
    });
    this._audios.set(url, pending);
    this._audioRefs.set(url, 1);
    return pending.then(cloneAudioAsset);
  }

  async loadText(url: string, signal?: AbortSignal): Promise<TextAsset> {
    const cached = this._texts.get(url);
    if (cached) {
      this._retain(this._textRefs, url);
      return cached.then(cloneTextAsset);
    }
    const pending = (async () => {
      if (this._config.fetchText) {
        return { id: url, type: 'text', content: await this._config.fetchText(url, { signal }) } satisfies TextAsset;
      }
      if (!this._fetch) {
        throw new Error('Text loading requires resource.fetch or global fetch in HeadlessPlatform');
      }
      const response = await this._fetch(url, { signal });
      const content = await response.text();
      return { id: url, type: 'text', content } satisfies TextAsset;
    })().catch((error) => {
      this._texts.delete(url);
      this._textRefs.delete(url);
      throw error;
    });
    this._texts.set(url, pending);
    this._textRefs.set(url, 1);
    return pending.then(cloneTextAsset);
  }

  async loadBinary(url: string, signal?: AbortSignal): Promise<BinaryAsset> {
    const cached = this._binaries.get(url);
    if (cached) {
      this._retain(this._binaryRefs, url);
      return cached.then(cloneBinaryAsset);
    }
    const pending = (async () => {
      if (this._config.fetchBinary) {
        return {
          id: url,
          type: 'binary',
          content: await this._config.fetchBinary(url, { signal }),
        } satisfies BinaryAsset;
      }
      if (!this._fetch) {
        throw new Error('Binary loading requires resource.fetch or global fetch in HeadlessPlatform');
      }
      const response = await this._fetch(url, { signal });
      const content = await response.arrayBuffer();
      return { id: url, type: 'binary', content } satisfies BinaryAsset;
    })().catch((error) => {
      this._binaries.delete(url);
      this._binaryRefs.delete(url);
      throw error;
    });
    this._binaries.set(url, pending);
    this._binaryRefs.set(url, 1);
    return pending.then(cloneBinaryAsset);
  }

  unload(asset: Asset): void {
    switch (asset.type) {
      case 'image':
        this._release(this._images, this._imageRefs, asset.id);
        return;
      case 'audio':
        this._release(this._audios, this._audioRefs, asset.id);
        return;
      case 'text':
        this._release(this._texts, this._textRefs, asset.id);
        return;
      case 'binary':
        this._release(this._binaries, this._binaryRefs, asset.id);
        return;
      default:
        return;
    }
  }

  clear(): void {
    this._images.clear();
    this._audios.clear();
    this._texts.clear();
    this._binaries.clear();
    this._imageRefs.clear();
    this._audioRefs.clear();
    this._textRefs.clear();
    this._binaryRefs.clear();
  }

  private _retain(refs: Map<string, number>, url: string) {
    refs.set(url, (refs.get(url) ?? 0) + 1);
  }

  private _release<TAsset>(entries: Map<string, Promise<TAsset>>, refs: Map<string, number>, url: string): void {
    const count = refs.get(url);
    if (count === undefined) {
      return;
    }
    if (count > 1) {
      refs.set(url, count - 1);
      return;
    }
    refs.delete(url);
    entries.delete(url);
  }
}

function resolveGlobalFetch(): ((url: string, options?: { signal?: AbortSignal }) => Promise<Response>) | undefined {
  if (typeof globalThis.fetch === 'function') {
    return (url: string, options?: { signal?: AbortSignal }) => globalThis.fetch(url, options);
  }
  return undefined;
}

function cloneImageAsset(asset: ImageAsset): ImageAsset {
  return { ...asset };
}

function cloneAudioAsset(asset: AudioAsset): AudioAsset {
  return { ...asset };
}

function cloneTextAsset(asset: TextAsset): TextAsset {
  return { ...asset };
}

function cloneBinaryAsset(asset: BinaryAsset): BinaryAsset {
  return { ...asset };
}
