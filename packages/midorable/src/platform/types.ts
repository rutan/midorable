/**
 * 色情報
 */
export interface Color {
  /** 色の赤成分（0〜255） */
  r: number;
  /** 色の緑成分（0〜255） */
  g: number;
  /** 色の青成分（0〜255） */
  b: number;
  /** 色の透明度（0〜1） */
  a: number;
}

/**
 * 2D用の幅・高さ情報
 */
export interface Size {
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
}

/**
 * 矩形情報
 */
export interface Rectangle {
  /** 左上のX座標 */
  x: number;
  /** 左上のY座標 */
  y: number;
  /** 幅 */
  width: number;
  /** 高さ */
  height: number;
}

/**
 * フォント情報
 *
 * @remarks
 * フォントのサポート状況や各パラメータの解釈方法はプラットフォームによって異なる。
 */
export interface Font {
  /**
   * フォント名
   *
   * @remarks
   * フォント名は配列でも指定できる。
   * 配列で指定された場合、プラットフォームは、配列の先頭から順にフォントを検索し、最初に見つかったフォントを使用する。
   */
  family: string | string[];

  /** フォントサイズ（ピクセル単位） */
  size: number;

  /** フォントの太さ */
  weight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;

  /** フォントのスタイル */
  style?: 'normal' | 'italic' | 'oblique';
}

/**
 * テキストの配置方法
 */
export type Align = 'left' | 'center' | 'right';

/**
 * 描画の合成方法
 */
export type BlendMode = 'normal' | 'add' | 'subtract' | 'multiply' | 'screen';

/**
 * メディアクエリ
 */
export type MediaQuery = { type: 'image' | 'audio'; mime: string };

/**
 * メディアクエリのサポートレベル
 */
export type MediaSupportLevel = 'supported' | 'unsupported' | 'unknown';

/**
 * システムカーソルの種類
 */
export type CursorName = 'default' | 'pointer';
