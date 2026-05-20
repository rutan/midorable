import { multiplyTransform } from '../internal';
import { RenderState, RenderableImage, Renderer } from '../renderer';
import { Rectangle } from '../types';
import { DisplayObject, DisplayObjectProps } from './DisplayObject';

/**
 * Sprite の初期化パラメータ
 */
export interface SpriteProps extends DisplayObjectProps {
  /** 描画する画像またはテクスチャ */
  image: RenderableImage;
  /** 描画する画像の一部を指定する矩形（省略した場合は画像全体を描画） */
  frame?: Rectangle | null;
}

/**
 * 画像を描画する表示オブジェクト
 *
 * @remarks
 * 画像アセットまたはテキスチャを描画するための表示オブジェクト。
 * `frame` プロパティを指定することで、画像の一部を切り出して描画することもできる。
 *
 * @example
 * ```ts
 * const sprite = new Sprite({
 *   context,
 *   image: myImageAsset,
 *   frame: { x: 0, y: 0, width: 32, height: 32 },
 * });
 * app.root.addChild(sprite);
 * ```
 */
export class Sprite extends DisplayObject {
  private _image: RenderableImage;
  private _frame: Rectangle | null;

  constructor(config: SpriteProps) {
    super(config);
    this._image = config.image;
    this._frame = config.frame ?? null;
  }

  /**
   * 描画に使用する画像またはテクスチャ
   */
  get image() {
    return this._image;
  }

  /**
   * 描画する画像の一部を指定する矩形
   */
  get frame() {
    return this._frame;
  }

  /**
   * 表示オブジェクトを破棄する
   *
   * @remarks
   * 描画対象がテクスチャかつ共有フラグが false の場合、テクスチャも破棄する。
   * それ以外の場合は、描画対象の破棄は行わない。
   */
  dispose() {
    if ('dispose' in this._image && !this._image.isShared) {
      this._image.dispose();
    }

    super.dispose();
  }

  protected renderSelf(renderer: Renderer, state: RenderState) {
    const bounds = this.getAnchorAdjustedLocalBounds();
    if (!bounds) {
      return;
    }
    renderer.drawSprite(this._image, withOffset(state, bounds.x, bounds.y), this._frame);
  }

  getLocalBounds() {
    const width = this._frame ? this._frame.width : this._image.width;
    const height = this._frame ? this._frame.height : this._image.height;
    if (this._frame) {
      return {
        x: 0,
        y: 0,
        width,
        height,
      };
    }
    return {
      x: 0,
      y: 0,
      width,
      height,
    };
  }

  /**
   * 描画する画像の一部を指定する矩形を設定する
   * @param frame - 描画する画像の一部を指定する矩形
   */
  setFrame(frame: Rectangle) {
    this._frame = frame;
  }

  /**
   * 描画する画像の一部を指定する矩形をリセットし、画像全体を描画するようにする
   */
  resetFrame() {
    this._frame = null;
  }
}

function withOffset(state: RenderState, x: number, y: number): RenderState {
  return {
    transform: multiplyTransform(state.transform, {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: x,
      ty: y,
    }),
    alpha: state.alpha,
    blendMode: state.blendMode,
    colorTone: state.colorTone,
    smooth: state.smooth,
  };
}
