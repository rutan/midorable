import { clamp, multiplyTransform } from '../internal';
import { RenderState, RenderableImage, Renderer, Transform2D } from '../renderer';
import { Rectangle } from '../types';
import { DisplayObject, DisplayObjectProps } from './DisplayObject';

/**
 * 9パッチのスライス情報
 */
export interface NinePatchSlice {
  /** 左端の幅 */
  left: number;
  /** 上端の高さ */
  top: number;
  /** 右端の幅 */
  right: number;
  /** 下端の高さ */
  bottom: number;
}

/**
 * NinePatch の初期化パラメータ
 */
export interface NinePatchProps extends DisplayObjectProps {
  image: RenderableImage;
  slice: NinePatchSlice;
  width: number;
  height: number;
}

/**
 * 9パッチ画像を描画する表示オブジェクト
 *
 * @remarks
 * 1つの画像を、4つのコーナー、4つのエッジ、1つのセンターの合計9つの領域に分割して描画する。
 * コーナーは元のサイズで描画され、エッジは片方向にのみ引き伸ばされ、センターは両方向に引き伸ばされる。
 * ウィンドウやボタンなど、サイズが可変のUI要素の背景などに利用することを想定している。
 *
 * @example
 * ```ts
 * const ninePatch = new NinePatch({
 *   context,
 *   image: myImageAsset,
 *   slice: { left: 10, top: 10, right: 10, bottom: 10 },
 *   width: 200,
 *   height: 100,
 * });
 * ```
 */
export class NinePatch extends DisplayObject {
  private _image: RenderableImage;
  private _slice: NinePatchSlice;
  private _width: number;
  private _height: number;

  constructor(config: NinePatchProps) {
    super(config);
    this._image = config.image;
    this._slice = { ...config.slice };
    const size = this.normalizeSize(config.width, config.height);
    this._width = size.width;
    this._height = size.height;
  }

  /**
   * 9パッチ画像のソース
   */
  get image() {
    return this._image;
  }

  /**
   * 9パッチのスライス情報
   */
  get slice() {
    return this._slice;
  }

  /**
   * 描画する幅
   */
  get width() {
    return this._width;
  }

  set width(value: number) {
    const size = this.normalizeSize(value, this._height);
    this._width = size.width;
  }

  /**
   * 描画する高さ
   */
  get height() {
    return this._height;
  }

  set height(value: number) {
    const size = this.normalizeSize(this._width, value);
    this._height = size.height;
  }

  /**
   * 表示オブジェクトを破棄する
   *
   * @remarks
   * 9パッチ画像のソースが共有テクスチャでない場合、テクスチャも同時に破棄する。
   * 共有テクスチャの場合や画像アセットの場合は破棄しない。
   */
  dispose() {
    if ('dispose' in this._image && !this._image.isShared) {
      this._image.dispose();
    }
    super.dispose();
  }

  /**
   * 描画するサイズを設定する
   *
   * @remarks
   * スライス情報に基づき、最小サイズを下回らないように自動調整される。
   *
   * @param width - 幅
   * @param height - 高さ
   */
  setSize(width: number, height: number) {
    const size = this.normalizeSize(width, height);
    this._width = size.width;
    this._height = size.height;
  }

  /**
   * スライス情報を設定する
   * @param slice - スライス情報
   */
  setSlice(slice: NinePatchSlice) {
    this._slice = { ...slice };
    const size = this.normalizeSize(this._width, this._height);
    this._width = size.width;
    this._height = size.height;
  }

  /**
   * 表示オブジェクト自身を描画する
   * @param renderer - レンダラー
   * @param state - 描画状態
   */
  protected renderSelf(renderer: Renderer, state: RenderState) {
    const texW = this._image.width;
    const texH = this._image.height;
    if (texW <= 0 || texH <= 0) {
      return;
    }
    const slice = normalizeSlice(this._slice, texW, texH);
    const minWidth = slice.left + slice.right;
    const minHeight = slice.top + slice.bottom;
    const width = Math.max(this._width, minWidth);
    const height = Math.max(this._height, minHeight);
    const bounds = this.getAnchorAdjustedLocalBounds();
    if (!bounds) {
      return;
    }
    const offsetX = bounds.x;
    const offsetY = bounds.y;

    const srcX0 = 0;
    const srcX1 = slice.left;
    const srcX2 = texW - slice.right;
    const srcX3 = texW;
    const srcY0 = 0;
    const srcY1 = slice.top;
    const srcY2 = texH - slice.bottom;
    const srcY3 = texH;

    const dstX0 = 0;
    const dstX1 = slice.left;
    const dstX2 = width - slice.right;
    const dstX3 = width;
    const dstY0 = 0;
    const dstY1 = slice.top;
    const dstY2 = height - slice.bottom;
    const dstY3 = height;

    // Corners
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX0, y: srcY0, width: srcX1 - srcX0, height: srcY1 - srcY0 },
      dstX0 + offsetX,
      dstY0 + offsetY,
      dstX1 - dstX0,
      dstY1 - dstY0,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX2, y: srcY0, width: srcX3 - srcX2, height: srcY1 - srcY0 },
      dstX2 + offsetX,
      dstY0 + offsetY,
      dstX3 - dstX2,
      dstY1 - dstY0,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX0, y: srcY2, width: srcX1 - srcX0, height: srcY3 - srcY2 },
      dstX0 + offsetX,
      dstY2 + offsetY,
      dstX1 - dstX0,
      dstY3 - dstY2,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX2, y: srcY2, width: srcX3 - srcX2, height: srcY3 - srcY2 },
      dstX2 + offsetX,
      dstY2 + offsetY,
      dstX3 - dstX2,
      dstY3 - dstY2,
    );

    // Edges
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX1, y: srcY0, width: srcX2 - srcX1, height: srcY1 - srcY0 },
      dstX1 + offsetX,
      dstY0 + offsetY,
      dstX2 - dstX1,
      dstY1 - dstY0,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX1, y: srcY2, width: srcX2 - srcX1, height: srcY3 - srcY2 },
      dstX1 + offsetX,
      dstY2 + offsetY,
      dstX2 - dstX1,
      dstY3 - dstY2,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX0, y: srcY1, width: srcX1 - srcX0, height: srcY2 - srcY1 },
      dstX0 + offsetX,
      dstY1 + offsetY,
      dstX1 - dstX0,
      dstY2 - dstY1,
    );
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX2, y: srcY1, width: srcX3 - srcX2, height: srcY2 - srcY1 },
      dstX2 + offsetX,
      dstY1 + offsetY,
      dstX3 - dstX2,
      dstY2 - dstY1,
    );

    // Center
    drawStretched(
      renderer,
      state,
      this._image,
      { x: srcX1, y: srcY1, width: srcX2 - srcX1, height: srcY2 - srcY1 },
      dstX1 + offsetX,
      dstY1 + offsetY,
      dstX2 - dstX1,
      dstY2 - dstY1,
    );
  }

  getLocalBounds() {
    return {
      x: 0,
      y: 0,
      width: this._width,
      height: this._height,
    };
  }

  private normalizeSize(width: number, height: number) {
    const texW = this._image.width;
    const texH = this._image.height;
    const slice = normalizeSlice(this._slice, texW, texH);
    const minWidth = slice.left + slice.right;
    const minHeight = slice.top + slice.bottom;
    return {
      width: Math.max(width, minWidth),
      height: Math.max(height, minHeight),
    };
  }
}

function drawStretched(
  renderer: Renderer,
  state: RenderState,
  image: RenderableImage,
  frame: Rectangle,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (frame.width <= 0 || frame.height <= 0 || width <= 0 || height <= 0) {
    return;
  }
  const scaleX = width / frame.width;
  const scaleY = height / frame.height;
  const transform = createTransform(x, y, scaleX, scaleY);
  renderer.drawSprite(image, withTransform(state, transform), frame);
}

function normalizeSlice(slice: NinePatchSlice, texW: number, texH: number): NinePatchSlice {
  const left = clamp(slice.left, 0, texW);
  const right = clamp(slice.right, 0, texW - left);
  const top = clamp(slice.top, 0, texH);
  const bottom = clamp(slice.bottom, 0, texH - top);
  return { left, top, right, bottom };
}

function createTransform(x: number, y: number, scaleX: number, scaleY: number): Transform2D {
  return {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    tx: x,
    ty: y,
  };
}

function withTransform(state: RenderState, local: Transform2D): RenderState {
  return {
    transform: multiplyTransform(state.transform, local),
    alpha: state.alpha,
    blendMode: state.blendMode,
    colorTone: state.colorTone,
    smooth: state.smooth,
  };
}
