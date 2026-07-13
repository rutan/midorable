/**
 * 共通で実装されることを推奨する『半公式』機能群
 *
 * @remarks
 * これらの機能は、プラットフォーム実装において共通して実装されることが推奨されるが、必須ではない。
 * プラットフォームは、これらの機能の一部または全部をサポートしなくても良い。
 */
export interface StandardPlatformFeatureRegistry {
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

export interface PlatformFeatureRegistry extends StandardPlatformFeatureRegistry {}
