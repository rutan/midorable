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
