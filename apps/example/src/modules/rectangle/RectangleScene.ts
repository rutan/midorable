import { DisplayObject, type DisplayObjectProps, Sprite, type SpriteProps, Texture } from '@rutan/midorable';
import { sceneRouter } from '../_share';

const COLORS = [
  { r: 255, g: 0, b: 0, a: 1 },
  { r: 0, g: 255, b: 0, a: 1 },
  { r: 0, g: 0, b: 255, a: 1 },
  { r: 255, g: 255, b: 0, a: 1 },
  { r: 0, g: 255, b: 255, a: 1 },
  { r: 255, g: 0, b: 255, a: 1 },
  { r: 192, g: 192, b: 192, a: 1 },
  { r: 128, g: 128, b: 128, a: 1 },
  { r: 128, g: 0, b: 0, a: 1 },
  { r: 128, g: 128, b: 0, a: 1 },
  { r: 0, g: 128, b: 0, a: 1 },
  { r: 128, g: 0, b: 128, a: 1 },
  { r: 0, g: 128, b: 128, a: 1 },
  { r: 0, g: 0, b: 128, a: 1 },
  { r: 255, g: 165, b: 0, a: 1 },
  { r: 255, g: 192, b: 203, a: 1 },
];

export const RectangleSceneDef = sceneRouter.defineScene('rectangle', {
  create({ context }) {
    return new RectangleSceneView({ context });
  },
});

export class RectangleSceneView extends DisplayObject {
  private _textures!: Texture[];
  private _rectangleSprites!: Sprite[];

  constructor(props: DisplayObjectProps) {
    super(props);

    this._textures = COLORS.map((color) => {
      const texture = this.context.app.createTexture(64, 64);
      texture.isShared = true;
      texture.drawRect({ x: 0, y: 0, width: 64, height: 64, color });
      return texture;
    });

    this._rectangleSprites = Array.from({ length: 100 }, () => {
      const sprite = new RectangleSprite({
        context: this.context,
        image: this._textures[Math.floor(Math.random() * this._textures.length)],
        anchorX: 0.5,
        anchorY: 0.5,
      });
      sprite.x = Math.random() * this.context.app.width;
      sprite.y = Math.random() * this.context.app.height;
      this.addChild(sprite);
      return sprite;
    });
  }

  async dispose() {
    this._rectangleSprites.forEach((sprite) => sprite.dispose());
    this._textures.forEach((texture) => texture.dispose());
    super.dispose();
  }
}

class RectangleSprite extends Sprite {
  private _speed: number;
  private _rotationSpeed: number;
  private _moveAngle: number;

  constructor(props: SpriteProps) {
    super(props);

    this._speed = 2 + Math.random() * 5;
    this._rotationSpeed = (Math.random() - 0.5) * 0.1;
    this._moveAngle = Math.random() * Math.PI * 2;
    this.interactive = true;

    this.onUpdate.on(this._handleUpdate);
    this.onPointerEnter.on(this._handleHover);
    this.onPointerLeave.on(this._handleHoverOut);
  }

  private _handleUpdate = () => {
    this.x += Math.cos(this._moveAngle) * this._speed;
    this.y += Math.sin(this._moveAngle) * this._speed;
    this.rotation += this._rotationSpeed;

    if (this.x < 0 || this.x > this.context.app.width) {
      this._moveAngle = Math.PI - this._moveAngle;
    }
    if (this.y < 0 || this.y > this.context.app.height) {
      this._moveAngle = -this._moveAngle;
    }
  };

  private _handleHover = () => {
    this.opacity = 0.5;
  };

  private _handleHoverOut = () => {
    this.opacity = 1;
  };
}
