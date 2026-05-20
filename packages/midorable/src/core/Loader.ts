import { Asset, AssetSpec, AssetSpecMap, ResolvedAsset, ResolvedAssets } from './asset';
import { Platform } from './platform';

export interface LoaderConfig {
  onDispose?: () => void;
}

export interface LoadOptions {
  /** アセットのキー */
  key?: string;

  /** 読み込みを中断するためのシグナル */
  signal?: AbortSignal;

  /** 読み込みのリトライに関するオプション */
  retry?: LoaderRetryOptions;
}

export interface LoaderRetryOptions {
  /** 最大リトライ回数 */
  maxRetries?: number;

  /** リトライ前の待機時間（ミリ秒） */
  delay?: number;
}

export interface LoadAllOptions {
  /** 読み込みを中断するためのシグナル */
  signal?: AbortSignal;
  /** 読み込みのリトライに関するオプション */
  retry?: LoaderRetryOptions;
  /** 並列での読み込み数（デフォルトは5） */
  concurrency?: number;
  /** 読み込みの進行状況を通知するコールバック */
  onProgress?: (snapshot: LoadAllProgressSnapshot) => void | Promise<void>;
}

export interface LoadAllProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export interface LoadAllAssetEntry {
  key: string;
  type: AssetSpec['type'];
  src: string;
}

export interface LoadAllProgressSnapshot {
  progress: LoadAllProgress;
  currentAsset?: LoadAllAssetEntry;
}

export type TryLoadAllResult<TAsset extends AssetSpec> =
  | { ok: true; value: ResolvedAsset<TAsset> }
  | { ok: false; error: unknown };

export type TryLoadAllResults<TAssets extends AssetSpecMap> = {
  [TKey in keyof TAssets]: TryLoadAllResult<TAssets[TKey]>;
};

/**
 * アセットの読み込みと取得を管理するローダー
 *
 * @remarks
 * 原則として App.createLoader() で作成されたインスタンスを使用する。
 *
 * Loader は読み込み済みのアセットを内部に保持し、同じキーを使って再取得できます。
 * 同一のキーで複数回の読み込み要求があった場合、最初の要求が完了するまで待機し、その後はキャッシュされたアセットを返します。
 *
 * @example
 * ```ts
 * const loader = app.createLoader();
 * const playerImage = await loader.load({ type: 'image', src: 'player.png' });
 *
 * // 同じキーで再度読み込むとキャッシュされたアセットが返る
 * const samePlayerImage = await loader.load({ type: 'image', src: 'player.png' });
 * console.log(playerImage === samePlayerImage); // true
 *
 * // 読み込み済みのアセットは get() で取得できる
 * const cachedPlayerImage = loader.get('player.png');
 * ```
 */
export class Loader {
  private _platform: Platform;
  private _onDispose: (() => void) | null;

  private _disposed = false;
  private _cache: Map<string, Asset> = new Map();
  private _cacheTypes: Map<string, AssetSpec['type']> = new Map();
  private _inFlight: Map<string, InFlightEntry> = new Map();

  constructor(platform: Platform, config: LoaderConfig = {}) {
    this._platform = platform;
    this._onDispose = config.onDispose ?? null;
  }

  /**
   * このローダーが破棄されているかどうか
   */
  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * 既にロードされているアセットを取得
   *
   * @remarks
   * 読み込みリクエスト中のアセットは取得できない。
   *
   * @param key - 取得するアセットのキー
   * @returns アセット、存在しない場合はundefined
   */
  get(key: string): Asset | undefined {
    this._ensureActive();

    return this._cache.get(key) || undefined;
  }

  /**
   * アセットをロードする
   *
   * @remarks
   * 既に同じキーでロードされている場合はキャッシュから取得する。
   * 同じキーで複数回のロード要求があった場合、最初の要求が完了するまで待機し、その後はキャッシュされたアセットを返す。
   *
   * @param spec - ロードするアセットの定義
   * @param options - オプション
   * @returns ロードされたアセット
   */
  load<TSpec extends AssetSpec>(spec: TSpec, options?: LoadOptions): Promise<ResolvedAsset<TSpec>> {
    this._ensureActive();

    if (options?.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    const key = options?.key ?? spec.src;
    this._ensureKeyTypeMatches(key, spec.type);
    const cached = this._cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached as ResolvedAsset<TSpec>);

    let entry = this._inFlight.get(key);
    if (!entry) {
      const controller = new AbortController();
      const promise = this._loadAssetWithRetry(spec, options?.retry, controller.signal)
        .then((asset) => {
          this._ensureLoadedAssetTypeMatches(spec, asset);
          this._cache.set(key, asset);
          this._cacheTypes.set(key, spec.type);
          return asset;
        })
        .finally(() => {
          entry!.settled = true;
          this._inFlight.delete(key);
        });

      entry = {
        controller,
        promise,
        type: spec.type,
        consumers: 0,
        settled: false,
      };
      this._inFlight.set(key, entry);
    }

    return this._attachToInFlight<ResolvedAsset<TSpec>>(entry, options?.signal);
  }

  /**
   * 複数のアセットを一括でロードする
   *
   * @remarks
   * 内部的には load() を呼び出しているため、同じキーでの重複したロード要求はまとめられる。
   * 並列でのロード数は options.concurrency で制御できる。
   *
   * @param definitions - ロードするアセットの定義
   * @param options - オプション
   * @returns ロードされたアセットのマップ
   *
   * @example
   * ```ts
   * const assets = await loader.loadAll({
   *   player: { type: 'image', src: 'player.png' },
   *   backgroundMusic: { type: 'audio', src: 'bgm.mp3' },
   * });
   * console.log(assets.player); // ImageAsset
   * console.log(assets.backgroundMusic); // AudioAsset
   * ```
   */
  async loadAll<TAssets extends AssetSpecMap>(
    definitions: TAssets,
    options?: LoadAllOptions,
  ): Promise<ResolvedAssets<TAssets>> {
    const settled = await this._loadAllInternal(definitions, options, { rejectOnFirstError: true });
    return Object.fromEntries(
      Object.entries(settled).map(([key, result]) => {
        if (!result.ok) {
          throw result.error;
        }
        return [key, result.value] as const;
      }),
    ) as ResolvedAssets<TAssets>;
  }

  /**
   * 複数のアセットを一括でロードし、その結果を成功・失敗に関わらず返す
   *
   * @remarks
   * 内部的には load() を呼び出しているため、同じキーでの重複したロード要求はまとめられる。
   * `loadAll` と異なり、個々のアセットのロード結果を成功・失敗に関わらず返す。全体のロードが失敗することはない。
   *
   * @param definitions - ロードするアセットの定義
   * @param options - オプション
   * @returns ロードされたアセットの結果オブジェクト（成功・失敗の両方を含む）
   *
   * @example
   * ```ts
   * const results = await loader.tryLoadAll({
   *   player: { type: 'image', src: 'player.png' }, // 正常に取得可能なアセット
   *   missingAsset: { type: 'audio', src: 'missing.mp3' }, // 404 Not Found などのエラーを返すアセット
   * });
   * console.log(results.player); // { ok: true, value: ImageAsset }
   * console.log(results.missingAsset); // { ok: false, error: ... }
   * ```
   */
  async tryLoadAll<TAssets extends AssetSpecMap>(
    definitions: TAssets,
    options?: LoadAllOptions,
  ): Promise<TryLoadAllResults<TAssets>> {
    return this._loadAllInternal(definitions, options, { rejectOnFirstError: false });
  }

  private async _loadAssetWithRetry<TSpec extends AssetSpec>(
    spec: TSpec,
    retry?: LoaderRetryOptions,
    signal?: AbortSignal,
  ): Promise<ResolvedAsset<TSpec>> {
    const maxRetries = Math.max(0, retry?.maxRetries ?? 0);
    const delay = Math.max(0, retry?.delay ?? 0);

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfAborted(signal);

      try {
        return await this._platform.loadAsset(spec, { signal });
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries || isAbortError(error)) break;
        if (delay > 0) {
          await this._sleep(delay, signal);
        }
      }
    }

    throw lastError;
  }

  private _attachToInFlight<T extends Asset>(entry: InFlightEntry, signal?: AbortSignal): Promise<T> {
    entry.consumers += 1;

    const release = () => {
      entry.consumers -= 1;
      if (entry.consumers === 0 && !entry.settled) {
        entry.controller.abort();
      }
    };

    if (!signal) {
      return entry.promise.finally(release) as Promise<T>;
    }

    if (signal.aborted) {
      release();
      return Promise.reject(createAbortError());
    }

    return new Promise<T>((resolve, reject) => {
      let completed = false;
      const cleanup = () => {
        signal.removeEventListener('abort', onAbort);
        if (!completed) {
          completed = true;
          release();
        }
      };
      const onAbort = () => {
        cleanup();
        reject(createAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        (asset) => {
          cleanup();
          resolve(asset as T);
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
    });
  }

  private _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
      throwIfAborted(signal);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(createAbortError());
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  /**
   * 指定のアセットを破棄
   * @param asset - 破棄するアセット
   */
  async unload(asset: Asset) {
    if (this._disposed) return;

    for (const [key, cache] of this._cache.entries()) {
      if (cache === asset) {
        this._cache.delete(key);
        this._cacheTypes.delete(key);
        break;
      }
    }

    this._platform.unloadAsset(asset);
  }

  /**
   * 全ての読み込み済みアセットを破棄
   */
  async unloadAllAssets() {
    if (this._disposed) return;

    for (const cache of this._cache.values()) {
      this._platform.unloadAsset(cache);
    }
    this._cache.clear();
    this._cacheTypes.clear();
  }

  /**
   * ローダーを破棄
   */
  async dispose() {
    if (this._disposed) return;

    try {
      await this.unloadAllAssets();
    } finally {
      this._disposed = true;
      this._cache.clear();
      this._cacheTypes.clear();
      this._inFlight.clear();
      this._onDispose?.();
      this._onDispose = null;
    }
  }

  private _ensureActive() {
    if (this._disposed) {
      throw new Error('Loader has been disposed');
    }
  }

  private _ensureKeyTypeMatches(key: string, type: AssetSpec['type']) {
    const cachedType = this._cacheTypes.get(key);
    if (cachedType !== undefined && cachedType !== type) {
      throw new Error(`Asset key "${key}" is already cached as ${cachedType}, but ${type} was requested`);
    }

    const inFlightType = this._inFlight.get(key)?.type;
    if (inFlightType !== undefined && inFlightType !== type) {
      throw new Error(`Asset key "${key}" is already loading as ${inFlightType}, but ${type} was requested`);
    }
  }

  private _ensureLoadedAssetTypeMatches<TSpec extends AssetSpec>(
    spec: TSpec,
    asset: Asset,
  ): asserts asset is ResolvedAsset<TSpec> {
    if (asset.type !== spec.type) {
      throw new Error(`Platform returned ${asset.type} asset for ${spec.type} request: ${spec.src}`);
    }
  }

  private async _loadAllInternal<TAssets extends AssetSpecMap>(
    definitions: TAssets,
    options: LoadAllOptions | undefined,
    config: { rejectOnFirstError: boolean },
  ): Promise<TryLoadAllResults<TAssets>> {
    this._ensureActive();

    const assetEntries = Object.entries(definitions).map(([key, spec]) => ({
      key,
      spec,
      entry: { key, type: spec.type, src: spec.src } satisfies LoadAllAssetEntry,
    }));
    const progress: LoadAllProgress = {
      total: assetEntries.length,
      completed: 0,
      failed: 0,
      pending: assetEntries.length,
    };
    const concurrency = normalizeConcurrency(options?.concurrency);
    const results: Array<readonly [string, TryLoadAllResult<any>] | null> = Array.from(
      { length: assetEntries.length },
      () => null,
    );
    let nextIndex = 0;
    let firstError: unknown;

    await options?.onProgress?.({
      progress: { ...progress },
    });

    const worker = async () => {
      while (!config.rejectOnFirstError || firstError === undefined) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= assetEntries.length) {
          return;
        }

        const { key, spec, entry } = assetEntries[currentIndex]!;
        try {
          const asset = await this.load(spec, {
            key,
            signal: options?.signal,
            retry: options?.retry,
          });
          progress.completed += 1;
          progress.pending -= 1;
          results[currentIndex] = [key, { ok: true, value: asset } satisfies TryLoadAllResult<any>] as const;
          await options?.onProgress?.({
            progress: { ...progress },
            currentAsset: entry,
          });
        } catch (error) {
          progress.failed += 1;
          progress.pending -= 1;
          firstError ??= error;
          results[currentIndex] = [key, { ok: false, error } satisfies TryLoadAllResult<any>] as const;
          await options?.onProgress?.({
            progress: { ...progress },
            currentAsset: entry,
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, assetEntries.length) }, () => worker()));

    if (config.rejectOnFirstError && firstError !== undefined) {
      throw firstError;
    }

    return Object.fromEntries(
      results.filter((result): result is readonly [string, TryLoadAllResult<any>] => !!result),
    ) as TryLoadAllResults<TAssets>;
  }
}

interface InFlightEntry {
  controller: AbortController;
  promise: Promise<Asset>;
  type: AssetSpec['type'];
  consumers: number;
  settled: boolean;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createAbortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function normalizeConcurrency(concurrency?: number): number {
  if (concurrency === undefined) {
    return 5;
  }

  if (!Number.isFinite(concurrency)) {
    return 5;
  }

  return Math.max(1, Math.floor(concurrency));
}
