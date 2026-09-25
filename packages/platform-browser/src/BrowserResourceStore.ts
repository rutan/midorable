import { Asset, AudioAsset, BinaryAsset, ImageAsset, TextAsset } from '@rutan/midorable/platform';

type LoadAudio = (url: string, signal?: AbortSignal) => Promise<AudioAsset>;

export class BrowserResourceStore {
  private _images = new Map<string, Promise<ImageAsset>>();
  private _audios = new Map<string, Promise<AudioAsset>>();
  private _texts = new Map<string, Promise<TextAsset>>();
  private _binaries = new Map<string, Promise<BinaryAsset>>();
  private _loads = new WeakMap<Promise<Asset>, SharedLoad>();
  private _releases = new WeakMap<Asset, () => boolean>();

  async loadImage(url: string, signal?: AbortSignal): Promise<ImageAsset> {
    return this._load(
      this._images,
      url,
      async (signal) => {
        const image = new Image();
        const decoded = new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            image.onload = null;
            image.onerror = null;
            signal?.removeEventListener('abort', onAbort);
          };
          const onAbort = () => {
            image.src = '';
            cleanup();
            reject(createAbortError());
          };
          image.onload = () => {
            cleanup();
            resolve();
          };
          image.onerror = () => {
            cleanup();
            reject(new Error(`Failed to load image asset: ${url}`));
          };
          if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
          }
        });
        image.src = url;
        await decoded;
        return {
          id: url,
          type: 'image',
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
          source: image,
        } satisfies ImageAsset;
      },
      signal,
    );
  }

  async loadAudio(url: string, loadAudio: LoadAudio, signal?: AbortSignal): Promise<AudioAsset> {
    return this._load(this._audios, url, (sharedSignal) => loadAudio(url, sharedSignal), signal);
  }

  async loadText(url: string, signal?: AbortSignal): Promise<TextAsset> {
    return this._load(
      this._texts,
      url,
      async (signal) => {
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(`Failed to load text asset: ${url} (${response.status} ${response.statusText})`);
        }
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
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(`Failed to load binary asset: ${url} (${response.status} ${response.statusText})`);
        }
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
