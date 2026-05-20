import { Asset, AudioAsset, BinaryAsset, ImageAsset, TextAsset } from '@rutan/midorable';

type LoadAudio = (url: string, signal?: AbortSignal) => Promise<AudioAsset>;

export class BrowserResourceStore {
  private _images = new Map<string, Promise<ImageAsset>>();
  private _audios = new Map<string, Promise<AudioAsset>>();
  private _texts = new Map<string, Promise<TextAsset>>();
  private _binaries = new Map<string, Promise<BinaryAsset>>();
  private _imageRefs = new Map<string, number>();
  private _audioRefs = new Map<string, number>();
  private _textRefs = new Map<string, number>();
  private _binaryRefs = new Map<string, number>();

  async loadImage(url: string, signal?: AbortSignal): Promise<ImageAsset> {
    const cached = this._images.get(url);
    if (cached) {
      return this._retainCached(this._images, this._imageRefs, url, cached, cloneImageAsset, signal);
    }

    const pending = (async () => {
      throwIfAborted(signal);
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
    })().catch((error) => {
      this._images.delete(url);
      this._imageRefs.delete(url);
      throw error;
    });

    this._images.set(url, pending);
    this._imageRefs.set(url, 1);
    return pending.then(cloneImageAsset);
  }

  async loadAudio(url: string, loadAudio: LoadAudio, signal?: AbortSignal): Promise<AudioAsset> {
    const cached = this._audios.get(url);
    if (cached) {
      return this._retainCached(this._audios, this._audioRefs, url, cached, cloneAudioAsset, signal);
    }

    const pending = loadAudio(url, signal).catch((error) => {
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
      return this._retainCached(this._texts, this._textRefs, url, cached, cloneTextAsset, signal);
    }

    const pending = (async () => {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Failed to load text asset: ${url} (${response.status} ${response.statusText})`);
      }
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
      return this._retainCached(this._binaries, this._binaryRefs, url, cached, cloneBinaryAsset, signal);
    }

    const pending = (async () => {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`Failed to load binary asset: ${url} (${response.status} ${response.statusText})`);
      }
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

  unload(asset: Asset): boolean {
    switch (asset.type) {
      case 'image':
        return this._release(this._images, this._imageRefs, asset.id);
      case 'audio':
        return this._release(this._audios, this._audioRefs, asset.id);
      case 'text':
        return this._release(this._texts, this._textRefs, asset.id);
      case 'binary':
        return this._release(this._binaries, this._binaryRefs, asset.id);
      default:
        return false;
    }
  }

  clear() {
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

  private _retainCached<TAsset>(
    entries: Map<string, Promise<TAsset>>,
    refs: Map<string, number>,
    url: string,
    cached: Promise<TAsset>,
    clone: (asset: TAsset) => TAsset,
    signal?: AbortSignal,
  ): Promise<TAsset> {
    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    this._retain(refs, url);
    const cloned = cached.then(clone);
    if (!signal) {
      return cloned;
    }

    return new Promise<TAsset>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort);
        settled = true;
      };
      const onAbort = () => {
        if (settled) {
          return;
        }
        cleanup();
        this._release(entries, refs, url);
        reject(createAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
      cloned.then(
        (asset) => {
          if (settled) {
            return;
          }
          cleanup();
          resolve(asset);
        },
        (error) => {
          if (settled) {
            return;
          }
          cleanup();
          reject(error);
        },
      );
    });
  }

  private _release<TAsset>(entries: Map<string, Promise<TAsset>>, refs: Map<string, number>, url: string): boolean {
    const count = refs.get(url);
    if (count === undefined) {
      return false;
    }
    if (count > 1) {
      refs.set(url, count - 1);
      return false;
    }
    refs.delete(url);
    entries.delete(url);
    return true;
  }
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

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}
