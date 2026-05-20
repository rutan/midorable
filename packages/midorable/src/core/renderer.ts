import { ImageAsset } from './asset';
import { Align, BlendMode, Color, Font, Rectangle, Size } from './types';

export type RenderableImage = Texture | ImageAsset;

export type FilterUniformValue = number | readonly number[];

export interface ShaderFilterDefinition {
  /**
   * シェーダー言語の識別子。具体的な値は各 Platform が定義する。
   * 例: 'wgsl', 'glsl-es-300'
   */
  language: string;
  /**
   * フィルター本体のシェーダーコード。
   * 期待される構文とエントリーポイントは `language` に依存する。
   */
  fragment: string;
  uniforms?: Record<string, FilterUniformValue>;
}

export interface FilterInstance {
  /** フィルターの一意な識別子 */
  readonly id: string;
  /** フィルターの定義 */
  readonly definition: ShaderFilterDefinition;
  /** フィルターの有効/無効状態 */
  enabled: boolean;
  /** ユニフォームの値を設定 */
  setUniform(name: string, value: FilterUniformValue): void;
  /** フィルターを破棄 */
  dispose(): void;
}

/**
 * Platform が提供する描画機能のインターフェース
 *
 * @remarks
 * Core は 1 フレームごとに `beginFrame()`、`clear()`、描画メソッド群、`endFrame()` の順で呼び出す。
 * `drawSprite()` に渡される `RenderState.transform` は最終的なワールド変換であり、Platform はこの変換、
 * `alpha`, `blendMode`, `colorTone`, `smooth` を反映して描画する。
 */
export interface Renderer {
  /**
   * 描画前の初期化処理
   *
   * @remarks
   * 1 フレームの描画開始時に呼び出される。必要に応じて描画先の準備や状態のリセットを行う。
   */
  beginFrame(): void;

  /**
   * 描画後の最終化処理
   *
   * @remarks
   * 1 フレームの描画終了時に呼び出される。ダブルバッファの swap やコマンドの flush が必要な Platform は
   * ここで行う。
   */
  endFrame(): void;

  /** 描画内容のクリア */
  clear(color?: Color): void;

  /** スプライトの描画 */
  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null): void;

  /**
   * フィルターの適用
   *
   * @remarks
   * フィルター用の描画レイヤーを開始できた場合は true を返す。
   * true を返した場合、Core は対応する `popFilters()` を後で呼び出す。
   * false を返した場合、Core はフィルターなしで通常描画を継続し、`popFilters()` は呼び出さない。
   */
  pushFilters(filters: readonly FilterInstance[], state: RenderState): boolean;

  /**
   * フィルターの解除
   *
   * @remarks
   * `pushFilters()` が true を返した場合にだけ呼び出される。
   */
  popFilters(): void;

  /**
   * マスク付き描画の開始
   *
   * @remarks
   * Core は `pushMask()` の後にマスク対象の通常描画を行い、続けて `activateMask()` を呼び出す。
   */
  pushMask(): void;

  /**
   * マスクレイヤーの描画へ切り替え
   *
   * @remarks
   * この呼び出しの後、Core は mask オブジェクトを描画する。その後 `popMask()` を呼び出す。
   */
  activateMask(): void;

  /**
   * マスクの解除
   *
   * @remarks
   * `pushMask()` で開始したマスク付き描画を終了する。
   */
  popMask(): void;

  /** 描画領域のリサイズ */
  resize(width: number, height: number): void;
}

export interface DrawTexturedTrianglesParams {
  /** 描画に使用する画像またはテクスチャ */
  image: RenderableImage;
  /** 描画状態 */
  state: RenderState;
  /** ローカル座標の頂点列。x, y の順に並べる */
  positions: ArrayLike<number>;
  /** UV 座標列。u, v の順に 0.0〜1.0 の値を並べる */
  uvs: ArrayLike<number>;
  /** 三角形インデックス列。3要素で1つの三角形を表す */
  indices: ArrayLike<number>;
  /**
   * テクスチャ色に乗算する色。
   *
   * @remarks
   * `RenderState.colorTone` は Sprite と同じ色調補正として適用され、
   * `tint` はその後に乗算される。
   */
  tint?: Color;
}

/**
 * 任意のテクスチャ付き三角形メッシュを描画する拡張機能。
 *
 * @remarks
 * 基本 Renderer の必須機能ではない。利用側は `app.getFeature('renderer.mesh')`
 * で存在確認してから使用する。
 */
export interface RendererMeshFeature {
  drawTexturedTriangles(params: DrawTexturedTrianglesParams): void;
}

export interface RenderState {
  /** 描画の変換行列 */
  transform: Transform2D;
  /** 描画の透明度 */
  alpha: number;
  /** ブレンドモード */
  blendMode: BlendMode;
  /** カラートーン */
  colorTone: Color;
  /** 補間適用するか */
  smooth: boolean;
}

export interface Texture {
  /** テクスチャの幅 */
  width: number;

  /** テクスチャの高さ */
  height: number;

  /**
   * テクスチャのソース
   * 返す値の型はプラットフォーム依存。
   * アプリケーション側に露出不能な場合、プラットフォームは null を返しても良い。
   */
  source: unknown;

  /**
   * 共有テクスチャであるか
   *
   * @remarks
   * `createTexture()` で作成した編集可能なテクスチャは通常 `isShared: false` とする。
   * `loadAsset()` などで共有管理される画像由来のテクスチャは `isShared: true` とする。
   * `isShared: false` の Texture は Sprite / NinePatch / ParticleEmitter の dispose 時に自動破棄されることがある。
   *
   * 画像読み込みなどの生成されたテクスチャが該当する。
   * 共有テクスチャの場合、midorable の Sprite 等は破棄時にテクスチャを dispose しない。
   */
  isShared: boolean;

  /**
   * テクスチャを破棄
   */
  dispose(): void;

  /**
   * 線を描画
   * lineWidth が省略された場合は 1 が使用される
   * @param params - 描画パラメータ
   */
  drawLine(params: { sx: number; sy: number; ex: number; ey: number; color: Color; lineWidth?: number }): void;

  /**
   * 四角形を描画
   * fill が省略された場合は塗りつぶしが行われる
   * @param params - 描画パラメータ
   */
  drawRect(params: { x: number; y: number; width: number; height: number; color: Color; fill?: boolean }): void;

  /**
   * テキストを描画
   * align が省略された場合は 'left' が使用される
   * maxWidth が省略された場合は無制限（環境依存）となる
   * outlineWidth と outlineColor が指定された場合はアウトラインが描画される。片方のみ指定された場合は無視される。
   * @param params - 描画パラメータ
   */
  drawText(params: {
    text: string;
    x: number;
    y: number;
    font: Font;
    color: Color;
    lineHeight?: number;
    align?: Align;
    maxWidth?: number;
    outlineWidth?: number;
    outlineColor?: Color;
  }): void;

  /**
   * テキストのサイズを測定
   * maxWidth が省略された場合は無制限（環境依存）となる
   * @param params - 測定パラメータ
   */
  measureText(params: { text: string; font: Font; maxWidth?: number }): Size;

  /**
   * 指定した画像を描画
   * sw, sh が省略された場合は image.width, image.height が使用される
   * dw, dh が省略された場合は sw, sh が使用される
   * @param params - 描画パラメータ
   */
  drawImage(params: {
    image: RenderableImage;
    sx: number;
    sy: number;
    sw?: number;
    sh?: number;
    dx: number;
    dy: number;
    dw?: number;
    dh?: number;
  }): void;

  /**
   * テクスチャの内容を消去
   */
  clear(): void;
}

export interface Transform2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}
