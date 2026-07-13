import { ImageAsset } from './assets';
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

export interface FilterResource {
  /** Platform が保持するフィルターリソースを破棄 */
  dispose(): void;
}

export class FilterInstance {
  /** フィルターの定義 */
  readonly definition: ShaderFilterDefinition;
  /** Platform が保持するコンパイル済みリソース */
  readonly resource: FilterResource;
  /** フィルターの有効/無効状態 */
  enabled = true;
  private _disposed = false;
  private _uniformLayout = new Map<string, number>();
  private _uniformData: Float32Array;

  constructor(definition: ShaderFilterDefinition, resource: FilterResource) {
    this.definition = definition;
    this.resource = resource;
    const uniforms = definition.uniforms ?? {};
    this._uniformData = new Float32Array(Object.keys(uniforms).length * 4);
    let slot = 0;
    for (const [name, value] of Object.entries(uniforms)) {
      this._uniformLayout.set(name, slot);
      this.writeUniform(slot, value);
      slot += 1;
    }
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /** 現在のユニフォーム値をフレーム用にコピー */
  snapshotUniformData(): Float32Array {
    return this._uniformData.slice();
  }

  /** ユニフォームの値を設定 */
  setUniform(name: string, value: FilterUniformValue): void {
    if (this._disposed) {
      throw new Error('Filter is already disposed');
    }
    const slot = this._uniformLayout.get(name);
    if (slot === undefined) {
      throw new Error(`Unknown filter uniform: ${name}`);
    }
    this.writeUniform(slot, value);
  }

  /** フィルターを破棄 */
  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this.enabled = false;
    this.resource.dispose();
  }

  private writeUniform(slot: number, value: FilterUniformValue) {
    const offset = slot * 4;
    this._uniformData.fill(0, offset, offset + 4);
    if (typeof value === 'number') {
      this._uniformData[offset] = value;
      return;
    }
    for (let index = 0; index < Math.min(4, value.length); index += 1) {
      this._uniformData[offset + index] = value[index] ?? 0;
    }
  }
}

/**
 * Platform が提供する描画機能のインターフェース
 *
 * @remarks
 * Engine は1フレーム分の描画命令を構築し、`submitFrame()`を1回呼び出す。
 */
export interface Renderer {
  /** 1フレーム分の描画命令を同期的に受理する。戻った後に frame の内容を保持してはならない。 */
  submitFrame(frame: RenderFrame): void;
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

export const SPRITE_INSTANCE_STRIDE = 17;

export interface RenderFrame {
  readonly clearColor: Color;
  readonly commands: readonly RenderCommand[];
}

export type RenderCommand =
  | SpriteBatchCommand
  | DrawTexturedTrianglesCommand
  | { readonly type: 'pushMask' }
  | { readonly type: 'activateMask' }
  | { readonly type: 'popMask' }
  | PushFiltersCommand
  | { readonly type: 'popFilters' };

export interface SpriteBatchCommand {
  readonly type: 'spriteBatch';
  readonly image: RenderableImage;
  readonly blendMode: BlendMode;
  readonly smooth: boolean;
  readonly instanceCount: number;
  readonly instanceData: Float32Array;
}

export interface DrawTexturedTrianglesCommand extends DrawTexturedTrianglesParams {
  readonly type: 'drawTexturedTriangles';
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

export interface FilterBinding {
  readonly resource: FilterResource;
  readonly uniformData: Float32Array;
}

export interface PushFiltersCommand {
  readonly type: 'pushFilters';
  readonly filters: readonly FilterBinding[];
  readonly state: RenderState;
}

export interface RenderCommandEncoder {
  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null): void;
  drawTexturedTriangles(params: DrawTexturedTrianglesParams): void;
  pushFilters(filters: readonly FilterInstance[], state: RenderState): void;
  popFilters(): void;
  pushMask(): void;
  activateMask(): void;
  popMask(): void;
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
