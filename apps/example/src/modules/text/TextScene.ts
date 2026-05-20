import { DisplayObject, type DisplayObjectProps, Sprite, Texture } from '@rutan/midorable';
import { sceneRouter } from '../_share';

export const TextSceneDef = sceneRouter.defineScene('text', {
  create({ context }) {
    return new TextSceneView({ context });
  },
});

export class TextSceneView extends DisplayObject {
  constructor(props: DisplayObjectProps) {
    super(props);

    const texture = this.context.app.createTexture(this.context.app.width, this.context.app.height);

    const sprite = new Sprite({
      context: this.context,
      image: texture,
    });
    this.addChild(sprite);

    this._drawTextWithFrame(texture, {
      text: 'Hello! こんにちは、Midorable!',
      x: 10,
      y: 80,
      font: { family: 'GameFont', size: 30 },
      color: { r: 255, g: 255, b: 255, a: 1 },
      align: 'left',
    });

    this._drawTextWithFrame(texture, {
      text: 'Hello! こんにちは、Midorable!',
      x: texture.width / 2,
      y: 120,
      font: { family: 'GameFont', size: 30 },
      color: { r: 255, g: 0, b: 0, a: 1 },
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 4,
      align: 'center',
    });

    this._drawTextWithFrame(texture, {
      text: 'Hello! こんにちは、Midorable!',
      x: texture.width - 10,
      y: 160,
      font: { family: 'GameFont', size: 30 },
      color: { r: 0, g: 255, b: 255, a: 1 },
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 10,
      align: 'right',
    });

    this._drawTextWithFrame(texture, {
      text: 'とても長いテキストのサンプル。maxWidth: 250px。',
      x: 10,
      y: 200,
      font: { family: 'GameFont', size: 30 },
      color: { r: 255, g: 255, b: 255, a: 1 },
      maxWidth: 250,
    });

    this._drawTextWithFrame(texture, {
      text: '絵文字のサンプル。😀😃😄😁',
      x: 10,
      y: 240,
      font: { family: 'GameFont', size: 40 },
      color: { r: 255, g: 255, b: 255, a: 1 },
    });

    this._drawTextWithFrame(texture, {
      text: '小さい文字',
      x: 10,
      y: 300,
      font: { family: 'GameFont', size: 16 },
      color: { r: 255, g: 255, b: 255, a: 1 },
      align: 'left',
    });

    this._drawTextWithFrame(texture, {
      text: '大きい文字',
      x: 10,
      y: 330,
      font: { family: 'GameFont', size: 200 },
      color: { r: 255, g: 255, b: 255, a: 1 },
      align: 'left',
    });
  }

  private _drawTextWithFrame(texture: Texture, props: Parameters<Texture['drawText']>[0]) {
    const size = texture.measureText({ text: props.text, font: props.font, maxWidth: props.maxWidth });
    texture.drawRect({
      x: props.x - (props.align === 'center' ? size.width / 2 : props.align === 'right' ? size.width : 0),
      y: props.y,
      width: size.width,
      height: size.height,
      color: { r: 255, g: 255, b: 0, a: 1 },
      fill: false,
    });

    texture.drawText(props);
  }
}
