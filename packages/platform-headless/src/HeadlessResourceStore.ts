import { Asset, AudioAsset, BinaryAsset, ImageAsset, TextAsset } from '@rutan/midorable/platform';
import { HeadlessLoadedAssetSet, HeadlessResourceConfig } from './types';

export class HeadlessResourceStore {
  private _images = new Map<string, Promise<ImageAsset>>();
  private _audios = new Map<string, Promise<AudioAsset>>();
  private _texts = new Map<string, Promise<TextAsset>>();
  private _binaries = new Map<string, Promise<BinaryAsset>>();
  private _loads = new WeakMap<Promise<Asset>, SharedLoad>();
  private _releases = new WeakMap<Asset, () => boolean>();

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
    return this._load(
      this._images,
      url,
      async (signal) => {
        const loader = this._config.loadImage;
        if (!loader) {
          throw new Error('Image loading is not configured for HeadlessPlatform');
        }
        return loader(url, { signal });
      },
      signal,
    );
  }

  async loadAudio(url: string, signal?: AbortSignal): Promise<AudioAsset> {
    return this._load(
      this._audios,
      url,
      async (signal) => {
        const loader = this._config.loadAudio;
        if (!loader) {
          throw new Error('Audio loading is not configured for HeadlessPlatform');
        }
        return loader(url, { signal });
      },
      signal,
    );
  }

  async loadText(url: string, signal?: AbortSignal): Promise<TextAsset> {
    return this._load(
      this._texts,
      url,
      async (signal) => {
        if (this._config.fetchText) {
          return { id: url, type: 'text', content: await this._config.fetchText(url, { signal }) } satisfies TextAsset;
        }
        if (!this._fetch) {
          throw new Error('Text loading requires resource.fetch or global fetch in HeadlessPlatform');
        }
        const response = await this._fetch(url, { signal });
        const content = await response.text();
        return { id: url, type: 'text', content } satisfies TextAsset;
      },
      signal,
    );
  }

  async loadBinary(url: string, signal?: AbortSignal): Promise<BinaryAsset> {
    return this._load(
      this._binaries,
      url,
      async (signal) => {
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
      },
      signal,
    );
  }

  unload(asset: Asset): boolean {
    const release = this._releases.get(asset);
    if (!release) return false;
    this._releases.delete(asset);
    return release();
  }

  clear(): void {
    for (const entries of [this._images, this._audios, this._texts, this._binaries]) {
      for (const pending of entries.values()) {
        const state = this._loads.get(pending);
        if (state && !state.settled) state.controller.abort();
      }
      entries.clear();
    }
    this._releases = new WeakMap();
  }

  private _load<T extends Asset>(
    entries: Map<string, Promise<T>>,
    url: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(createAbortError());

    let pending = entries.get(url);
    let shared = pending && this._loads.get(pending);
    if (!pending || !shared) {
      const controller = new AbortController();
      const state: SharedLoad = {
        controller,
        refs: 0,
        consumers: 0,
        settled: false,
        remove: () => {
          if (entries.get(url) === pending) entries.delete(url);
        },
      };
      pending = (async () => load(controller.signal))().then(
        (asset) => {
          state.settled = true;
          return asset;
        },
        (error) => {
          state.settled = true;
          state.remove();
          throw error;
        },
      );
      shared = state;
      entries.set(url, pending);
      this._loads.set(pending, shared);
    }
    const state = shared;
    state.refs += 1;
    state.consumers += 1;
    const release = () => {
      state.refs -= 1;
      if (state.refs > 0) return false;
      state.remove();
      return true;
    };

    return new Promise<T>((resolve, reject) => {
      let completed = false;
      let cancelled = false;
      const cleanup = () => {
        completed = true;
        signal?.removeEventListener('abort', onAbort);
        if (!cancelled) state.consumers -= 1;
      };
      const onAbort = () => {
        if (completed || cancelled) return;
        cancelled = true;
        state.consumers -= 1;
        if (state.consumers === 0) {
          if (!state.settled) {
            state.remove();
            state.controller.abort();
          }
          // The last consumer waits for backend cleanup. If abort is ignored,
          // deliver the asset so its Loader can unload it before dispose completes.
          return;
        }
        cleanup();
        release();
        reject(createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      pending.then(
        (asset) => {
          if (completed) return;
          cleanup();
          const owned = { ...asset };
          this._releases.set(owned, release);
          resolve(owned);
        },
        (error) => {
          if (completed) return;
          cleanup();
          release();
          reject(error);
        },
      );
      if (signal?.aborted) onAbort();
    });
  }
}

interface SharedLoad {
  controller: AbortController;
  /** Pending acquisitions and assets retained by callers. */
  refs: number;
  /** Callers still waiting without having cancelled. */
  consumers: number;
  settled: boolean;
  remove: () => void;
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function resolveGlobalFetch(): ((url: string, options?: { signal?: AbortSignal }) => Promise<Response>) | undefined {
  if (typeof globalThis.fetch === 'function') {
    return (url: string, options?: { signal?: AbortSignal }) => globalThis.fetch(url, options);
  }
  return undefined;
}
