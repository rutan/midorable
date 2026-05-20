import { Asset, AssetSpec, ResolvedAsset } from './asset';
import { AudioBackend } from './audio';
import { InputBackend } from './inputs';
import { FilterInstance, Renderer, RendererMeshFeature, ShaderFilterDefinition, Texture } from './renderer';
import { CursorName, MediaQuery, MediaSupportLevel } from './types';

/**
 * アプリケーションが動作するプラットフォーム機能のインタフェース
 *
 * @remarks
 * Midorable のコア機能を動作させるために必要な機能を定義するインタフェース。
 * このインタフェースを満たす実装を行うことで、Midorable を様々な環境で動作させることができる。
 * 具体的な実装例は `@rutan/midorable-platform-browser` や
 * `@rutan/midorable-platform-headless` の各種プラットフォーム実装を参照。
 * 独自 Platform 実装者は、`renderer`, `audio`, `input`, asset loading, main loop を提供する。
 *
 * Core は `App` のライフサイクル内でこれらを呼び出すため、`stopLoop()` や `unloadAsset()` などの
 * 後始末系メソッドは、可能な限り冪等に実装することが望ましい。
 * 必須機能を実装できない環境では、呼び出されても安全な no-op 実装を提供するか、
 * その機能のメソッド内で明示的に reject / throw する。任意機能は `getFeature()` で undefined を返す。
 *
 * ゲーム開発者は原則的にこのインタフェースを直接操作することはなく、 `App` クラス等が提供するインタフェースを通じて利用する。
 */
export interface Platform {
  /** 画面レンダラー */
  renderer: Renderer;
  /** オーディオ再生機構 */
  audio: AudioBackend;
  /** 入力機構 */
  input: InputBackend;

  /**
   * シェーダーフィルター機能のサポート状況と能力。
   */
  readonly filterCapabilities?: RenderFilterCapabilities | null;

  /**
   * プラットフォーム側のリソースを解放する
   *
   * @remarks
   * このメソッド呼び出し後、Platform オブジェクトの機能は使用できなくなる
   */
  dispose(): void;

  /**
   * ループ処理を開始する
   *
   * @remarks
   * Platform は `stopLoop()` が呼ばれるまで、登録された `callback` を繰り返し呼び出す。
   * `callback` の `now` には単調増加する時刻をミリ秒で渡すことを想定している。
   * `startLoop()` が複数回呼ばれた場合は、既存のループを重複起動しないことが望ましい。
   *
   * @param callback - 現在の時刻を引数に取るループ処理のコールバック関数
   */
  startLoop(callback: (now: number) => void): void;

  /**
   * ループ処理を停止する
   *
   * @remarks
   * 以降 `startLoop()` で登録された callback が呼ばれないようにする。
   * すでに停止済みの場合は no-op として扱うことが望ましい。
   */
  stopLoop(): void;

  /**
   * 画面の論理サイズを変更する
   *
   * @remarks
   * このサイズとは実際の画面のピクセル数とは限らず、ゲーム内で使用する座標系の幅と高さを指す。
   * プラットフォーム側はこのサイズをもとに適切なスケーリングやセンタリング等の処理を行い、ゲームが指定された論理サイズで描画されるようにする必要がある。
   *
   * @param width - ゲームの論理的な幅
   * @param height - ゲームの論理的な高さ
   */
  resize(width: number, height: number): void;

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
  loadAsset<TSpec extends AssetSpec>(spec: TSpec, options?: LoadAssetOptions): Promise<ResolvedAsset<TSpec>>;

  /**
   * 読み込み済みアセットを解放する
   *
   * @remarks
   * `loadAsset()` が確保した Platform 側リソースを解放する。
   * 同じ asset が複数回渡された場合や、すでに解放済みの場合は no-op として扱うことが望ましい。
   *
   * @param asset - アセットオブジェクト
   */
  unloadAsset(asset: Asset): void;

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
   * const supportLevel = platform.mediaQuery({ type: 'audio', mime: 'audio/ogg' });
   * if (supportLevel === 'supported') {
   *   // Ogg Vorbis形式の音声がサポートされている場合の処理
   * } else {
   *   // サポートされていない場合の処理
   * }
   * ```
   */
  mediaQuery(query: MediaQuery): MediaSupportLevel;

  /**
   * テクスチャを作成する
   * @param width - テクスチャの幅
   * @param height - テクスチャの高さ
   */
  createTexture(width: number, height: number): Texture;

  /**
   * シェーダーフィルターを作成する
   *
   * @remarks
   * 定義オブジェクトの内容や、サポートされるシェーダー言語の種類はプラットフォームによって異なる。
   * そのためゲーム側は事前に filterCapabilities を確認し、対応したシェーダー言語を使用してフィルターを作成する必要がある。
   *
   * @param definition - シェーダーフィルターの定義
   * @returns 作成されたフィルターインスタンスを返すPromise。定義の内容がプラットフォームでサポートされない場合や、作成に失敗した場合はPromiseがrejectされる。
   */
  createFilter?(definition: ShaderFilterDefinition): Promise<FilterInstance>;

  /**
   * プラットフォーム固有の機能を取得する
   * @param key - 取得したい機能のキー
   * @returns その機能が存在する場合は機能オブジェクトを返し、存在しない場合は undefined を返す
   */
  getFeature<K extends keyof PlatformFeatureRegistry>(key: K): PlatformFeatureRegistry[K] | undefined;

  /**
   * システムカーソルを変更する
   * @param cursor - カーソルの種類
   */
  setCursor(cursor: CursorName): void;
}

/**
 * アセットの読み込みオプション
 */
export interface LoadAssetOptions {
  /** 読み込みのキャンセルに使用するAbortSignal */
  signal?: AbortSignal;
}

/**
 * 共通で実装されることを推奨する『半公式』機能群
 *
 * @remarks
 * これらの機能は、プラットフォーム実装において共通して実装されることが推奨されるが、必須ではない。
 * プラットフォームは、これらの機能の一部または全部をサポートしなくても良い。
 */
export interface StandardPlatformFeatureRegistry {
  /**
   * テクスチャ付き三角形メッシュ描画機能。
   */
  'renderer.mesh': RendererMeshFeature;

  /**
   * フォント機能
   */
  'system.font': SystemFontFeature;

  /**
   * URLを開く機能
   */
  'system.openUrl': SystemOpenUrlFeature;

  /**
   * 永続的なストレージ機能
   */
  'system.storage': SystemStorageFeature;

  /**
   * クリップボードへのアクセス機能
   */
  'system.clipboard': SystemClipboardFeature;

  /**
   * シェア機能
   */
  'system.share': SystemShareFeature;

  /**
   * ユーザーのロケールやタイムゾーンに関する機能
   */
  'system.locale': SystemLocaleFeature;

  /**
   * ユーザーに文字入力を促す機能。
   * 引数には、入力のヒントや初期値などを指定できるが、プラットフォームによっては無視されることもある。
   */
  'system.promptInput': SystemPromptInputFeature;

  /**
   * アプリケーションを終了する機能。
   * 引数には終了コードを指定できるが、プラットフォームによっては無視されることもある。
   */
  'system.exit': SystemExitFeature;
}

export interface SystemFontFeature {
  /**
   * フォントを読み込み、プラットフォームに登録する
   * @param fontName - フォント名。以降、font-familyなどでこの名前を使用してフォントを指定できるようになる。
   * @param url - フォントファイルのURL
   */
  loadFont(fontName: string, url: string): Promise<boolean>;
}

/**
 * URLを開く機能。
 * @param url - 開きたいURL
 */
export type SystemOpenUrlFeature = (url: string) => Promise<boolean>;

export interface SystemStorageFeature {
  /**
   * 値の取得
   * @param key - 取得したい値のキー
   */
  getItem(key: string): Promise<string | null>;
  /**
   * 値の設定
   * @param key - 設定する値のキー
   * @param value - 設定する値
   */
  setItem(key: string, value: string): Promise<void>;
  /**
   * 値の削除
   * @param key - 削除する値のキー
   */
  removeItem(key: string): Promise<void>;
  /**
   * すべての値をクリア
   */
  clear(): Promise<void>;
}

export interface SystemClipboardFeature {
  /**
   * クリップボードからテキストを読み取る
   */
  readText(): Promise<string>;
  /**
   * クリップボードにテキストを書き込む
   * @param text - 書き込みたいテキスト
   */
  writeText(text: string): Promise<void>;
}

export interface SystemShareData {
  title?: string;
  text?: string;
  url?: string;
}

export interface SystemShareFeature {
  /**
   * デバイスの共有機能を使用してデータを共有する
   * @param data - 共有するデータ
   */
  share(data: SystemShareData): Promise<void>;
}

export interface SystemLocaleFeature {
  /**
   * ユーザーのロケールを取得する
   */
  getLocale(): string;
  /**
   * ユーザーのタイムゾーンを取得する
   */
  getTimeZone(): string;
}

export type SystemPromptInputFeature = (options: {
  /** 入力ダイアログのタイトル */
  title?: string;
  /** 入力ダイアログの初期値 */
  defaultValue?: string;
  /** 複数行入力を許可するかどうか */
  multiline?: boolean;
  /** 送信ボタンのラベル（プラットフォームによっては無視される） */
  submitLabel?: string;
  /** キャンセルボタンのラベル（プラットフォームによっては無視される） */
  cancelLabel?: string;
}) => Promise<string | null>;

export type SystemExitFeature = (exitCode?: number) => Promise<boolean>;

export interface RenderFilterCapabilities {
  /**
   * Platform が受け付けるシェーダー言語識別子一覧。
   */
  shaderLanguages: readonly ShaderFilterDefinition['language'][];
}

export interface PlatformFeatureRegistry extends StandardPlatformFeatureRegistry {}
