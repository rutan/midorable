import type { Size } from './types';

/**
 * 共通で実装されることを推奨する『半公式』機能群
 *
 * @remarks
 * これらの機能は、プラットフォーム実装において共通して実装されることが推奨されるが、必須ではない。
 * プラットフォームは、これらの機能の一部または全部をサポートしなくても良い。
 */
export interface StandardPlatformFeatureRegistry {
  /**
   * ゲームの表示領域に関する機能
   */
  'system.screen': SystemScreenFeature;

  /**
   * フォント機能
   */
  'system.font': SystemFontFeature;

  /**
   * URLを開く機能
   */
  'system.openUrl': SystemOpenUrlFeature;

  /**
   * ゲームのセーブデータを読み書きする機能
   */
  'system.saveData': SystemSaveDataFeature;

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

/**
 * 画面状態
 *
 * @remarks
 * 値は「コンテナ座標系」で表す。
 * コンテナ座標系は、ゲームに割り当てられた領域の左上を原点とし、
 * プラットフォームのレイアウト単位（ブラウザであれば CSS ピクセル）を単位とする座標系である。
 * ゲームの論理座標系とは異なるため、論理座標で扱う場合は利用側で変換すること。
 */
export interface SystemScreenState {
  /**
   * ゲームに割り当てられた領域のサイズ
   */
  readonly viewSize: Readonly<Size>;
}

export interface SystemScreenFeature {
  /** 現在の画面状態を取得 */
  getState(): SystemScreenState;

  /**
   * 画面領域が変化したときに呼び出されるリスナーを登録する
   */
  readonly onChange: {
    on(listener: (state: SystemScreenState) => void): void;
    off(listener: (state: SystemScreenState) => void): void;
  };
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

/**
 * ゲームごとに1つの永続データ領域を文字列として読み書きする機能。
 */
export interface SystemSaveDataFeature {
  /**
   * ゲームのセーブデータを読み込む。未保存の場合は空文字列を返す。
   */
  load(): Promise<string>;
  /**
   * ゲームのセーブデータ全体を上書きする。
   * @param data - 保存する文字列データ
   */
  save(data: string): Promise<void>;
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
