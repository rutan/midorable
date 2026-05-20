import { DisplayObject, DisplayObjectProps, Sprite, Texture } from '@rutan/midorable';
import { FONT_NAME } from '../../constants';

/**
 * FPSカウンターを表示するスプライト
 */
export class FpsCounterSprite extends DisplayObject {
  private _texture: Texture;
  private _label: Sprite;
  private _fpsText = '';

  constructor(config: DisplayObjectProps) {
    super(config);

    this._texture = this.context.app.createTexture(120, 32);
    this._label = new Sprite({
      context: this.context,
      image: this._texture,
    });
    this.addChild(this._label);

    this.updateLabel();
    this.onUpdate.on(this.handleUpdate);
  }

  dispose() {
    this._texture.dispose();
    super.dispose();
  }

  private handleUpdate = () => {
    this.updateLabel();
  };

  private updateLabel() {
    const nextText = `FPS: ${this.context.app.stats.actualFps.toFixed(1)}`;
    if (this._fpsText === nextText) {
      return;
    }

    this._fpsText = nextText;
    this._texture.clear();
    this._texture.drawRect({
      x: 0,
      y: 0,
      width: this._texture.width,
      height: this._texture.height,
      color: { r: 0, g: 0, b: 0, a: 0.55 },
      fill: true,
    });
    this._texture.drawText({
      text: this._fpsText,
      x: 8,
      y: 9,
      font: { family: FONT_NAME, size: 14, weight: 'bold' },
      color: { r: 255, g: 255, b: 255, a: 1 },
      align: 'left',
    });
  }
}
