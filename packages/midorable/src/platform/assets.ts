import { MediaQuery, MediaSupportLevel } from './types';

/**
 * アセットの種類のリスト
 */
export const assetTypes = ['image', 'audio', 'text', 'binary'] as const;

/**
 * アセットの種類を表す型
 */
export type AssetType = (typeof assetTypes)[number];

/**
 * アプリケーション内で利用するアセットの基本インターフェース
 */
export interface Asset {
  /** アセットの一意な識別子 */
  id: string;
  /** アセットの種類 */
  type: AssetType;
}

/**
 * 音声アセット
 */
export interface AudioAsset extends Asset {
  /** アセットの種類 */
  type: 'audio';

  /**
   * 音声のソース
   *
   * @remarks
   * 何を返すかはプラットフォーム実装依存。
   */
  source: unknown;

  /**
   * 音声の再生時間（秒）
   *
   * @remarks
   * 環境によっては取得できない場合があり、その場合は `undefined` になります。
   */
  duration?: number;
}

/**
 * 画像アセット
 */
export interface ImageAsset extends Asset {
  /** アセットの種類 */
  type: 'image';

  /** 画像の幅 */
  width: number;

  /** 画像の高さ */
  height: number;

  /**
   * 画像のソース
   *
   * @remarks
   * 何を返すかはプラットフォーム実装依存。
   */
  source: unknown;
}

/**
 * テキストアセット
 *
 * @remarks
 * 基本的にテキストは UTF-8 であることを期待している。
 */
export interface TextAsset extends Asset {
  /** アセットの種類 */
  type: 'text';
  /** テキストの内容 */
  content: string;
}

/**
 * バイナリアセット
 */
export interface BinaryAsset extends Asset {
  /** アセットの種類 */
  type: 'binary';
  /** バイナリデータの内容 */
  content: ArrayBuffer;
}

/**
 * 読み込みリクエストを行う際のアセットの定義
 */
export type AssetSpec = ImageAssetSpec | AudioAssetSpec | TextAssetSpec | BinaryAssetSpec;

/** 画像アセットの定義 */
export type ImageAssetSpec = { type: 'image'; src: string };

/** 音声アセットの定義 */
export type AudioAssetSpec = { type: 'audio'; src: string };

/** テキストアセットの定義 */
export type TextAssetSpec = { type: 'text'; src: string };

/** バイナリアセットの定義 */
export type BinaryAssetSpec = { type: 'binary'; src: string };

export type AssetSpecMap = Record<string, AssetSpec>;

export interface ResolvedAssetTypeMap {
  image: ImageAsset;
  audio: AudioAsset;
  text: TextAsset;
  binary: BinaryAsset;
}

export type ResolvedAsset<TAsset extends AssetSpec> = ResolvedAssetTypeMap[TAsset['type']];

export type ResolvedAssets<TAssets extends AssetSpecMap> = {
  [TKey in keyof TAssets]: ResolvedAsset<TAssets[TKey]>;
};

/**
 * アセットの定義を作成するためのユーティリティ関数
 * @param src - 読み込み元のURL
 * @returns アセットの定義オブジェクト
 */
export function imageAsset(src: string): ImageAssetSpec {
  return { type: 'image', src };
}

/**
 * 音声アセットの定義を作成するためのユーティリティ関数
 * @param src - 読み込み元のURL
 * @returns アセットの定義オブジェクト
 */
export function audioAsset(src: string): AudioAssetSpec {
  return { type: 'audio', src };
}

/**
 * テキストアセットの定義を作成するためのユーティリティ関数
 * @param src - 読み込み元のURL
 * @returns アセットの定義オブジェクト
 */
export function textAsset(src: string): TextAssetSpec {
  return { type: 'text', src };
}

/**
 * バイナリアセットの定義を作成するためのユーティリティ関数
 * @param src - 読み込み元のURL
 * @returns アセットの定義オブジェクト
 */
export function binaryAsset(src: string): BinaryAssetSpec {
  return { type: 'binary', src };
}

/**
 * アセットを扱うPlatformの機能を表すインターフェース
 */
export interface AssetsBackend {
  /**
   * アセットを読み込む
   *
   * @remarks
   * `spec.type` に対応する `Asset` を返す。返却する asset の `type` は必ず `spec.type` と一致させる。
   * `id` は Platform 内で一意に扱える値にする。特別な理由がなければ `spec.src` を使ってよい。
   *
   * `options.signal` が abort された場合は、可能な限り読み込みを中断し、`AbortError` 相当のエラーで
   * reject する。すでに完了した読み込みや中断不能な読み込みでは、Platform の制約に応じて完了してもよい。
   *
   * @param spec - 読み込むアセット定義
   * @param options - オプション
   * @returns 読み込んだアセットオブジェクトを返すPromise。そのプラットフォームで非対応のアセット種別が指定された場合はPromiseがrejectされる。読み込みに失敗した場合も同様にrejectされる。
   */
  load<TSpec extends AssetSpec>(spec: TSpec, options?: LoadAssetOptions): Promise<ResolvedAsset<TSpec>>;

  /**
   * 読み込み済みアセットを解放する
   *
   * @remarks
   * `loadAsset()` が確保した Platform 側リソースを解放する。
   * 同じ asset が複数回渡された場合や、すでに解放済みの場合は no-op として扱うことが望ましい。
   *
   * @param asset - アセットオブジェクト
   */
  unload(asset: Asset): void;

  /**
   * メディア種別に応じた機能のサポート状況を返す。
   *
   * @remarks
   * 例えば、特定の音声フォーマットのサポート状況を確認するために使用される。
   *
   * @param query - メディアクエリ
   * @returns クエリに対するサポート状況
   *
   * @example
   * ```ts
   * const supportLevel = platform.assets.mediaQuery({ type: 'audio', mime: 'audio/ogg' });
   * if (supportLevel === 'supported') {
   *   // Ogg Vorbis形式の音声がサポートされている場合の処理
   * } else {
   *   // サポートされていない場合の処理
   * }
   * ```
   */
  mediaQuery(query: MediaQuery): MediaSupportLevel;
}

/**
 * アセットの読み込みオプション
 */
export interface LoadAssetOptions {
  /** 読み込みのキャンセルに使用するAbortSignal */
  signal?: AbortSignal;
}
