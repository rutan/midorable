import { DisplayObject, DisplayObjectProps, Sprite } from '@rutan/midorable';
import { GridSprite } from './modules/_share';

export interface StageProps extends DisplayObjectProps {}

export class Stage extends DisplayObject {
  private _mainLayer!: DisplayObject;

  constructor(props: StageProps) {
    super(props);
    this._createBackground();
    this._createGridLayer();
    this._createMainLayer();
  }

  get mainLayer() {
    return this._mainLayer;
  }

  private _createBackground() {
    const app = this.context.app;
    const backTexture = app.createTexture(app.width, app.height);
    backTexture.drawRect({
      x: 0,
      y: 0,
      width: app.width,
      height: app.height,
      color: { r: 64, g: 64, b: 64, a: 1 },
      fill: true,
    });
    const background = new Sprite({
      context: this.context,
      image: backTexture,
    });
    this.addChild(background);
  }

  private _createGridLayer() {
    const gridSprite = new GridSprite({
      context: this.context,
      width: this.context.app.width,
      height: this.context.app.height,
    });
    this.addChild(gridSprite);
  }

  private _createMainLayer() {
    this._mainLayer = new DisplayObject({
      context: this.context,
    });
    this.addChild(this._mainLayer);
  }
}
