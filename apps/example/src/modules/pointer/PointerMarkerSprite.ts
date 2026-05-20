import {
  Color,
  DisplayObject,
  DisplayObjectProps,
  ImageAsset,
  InputPointerState,
  PointerKind,
  Sprite,
  Texture,
} from '@rutan/midorable';
import { FONT_NAME } from '../_share';

const POINTER_LABEL_TEXTURE_WIDTH = 200;
const POINTER_LABEL_TEXTURE_HEIGHT = 40;

const POINTER_VISUAL_CONFIG: Record<
  PointerKind,
  {
    frameIndex: number;
    color: Color;
  }
> = {
  mouse: {
    frameIndex: 0,
    color: { r: 66, g: 135, b: 245, a: 1 },
  },
  touch: {
    frameIndex: 1,
    color: { r: 62, g: 200, b: 120, a: 1 },
  },
  pen: {
    frameIndex: 2,
    color: { r: 245, g: 166, b: 35, a: 1 },
  },
};

interface PointerMarkerSpriteProps extends DisplayObjectProps {
  type?: PointerKind;
  cursorImage: ImageAsset;
  cursorImageWidth: number;
}

export class PointerMarkerSprite extends DisplayObject {
  private _type: PointerKind;
  private _cursorImage: ImageAsset;
  private _cursorImageWidth: number;

  private _cursorSprite!: Sprite;
  private _labelTexture!: Texture;
  private _labelSprite!: Sprite;

  constructor(params: PointerMarkerSpriteProps) {
    super(params);
    this._type = params.type ?? 'mouse';
    this._cursorImage = params.cursorImage;
    this._cursorImageWidth = params.cursorImageWidth;

    this._createCursorSprite();
    this._createLabelSprite();
  }

  private _createCursorSprite() {
    this._cursorSprite = new Sprite({
      context: this._context,
      image: this._cursorImage,
      anchorX: 0.5,
      anchorY: 0.5,
      x: 0,
      y: 0,
      frame: {
        x: this._cursorImageFrameX(this._type),
        y: 0,
        width: this._cursorImageWidth,
        height: this._cursorImageWidth,
      },
    });
    this.addChild(this._cursorSprite);
  }

  private _createLabelSprite() {
    this._labelTexture = this._context.app.createTexture(POINTER_LABEL_TEXTURE_WIDTH, POINTER_LABEL_TEXTURE_HEIGHT);
    this._labelTexture.isShared = true;
    this._labelSprite = new Sprite({
      context: this._context,
      image: this._labelTexture,
      x: 20,
      y: 20,
    });
    this.addChild(this._labelSprite);
  }

  dispose() {
    this._labelTexture.dispose();
    super.dispose();
  }

  syncPointer(pointer: InputPointerState) {
    this._syncPointerType(pointer.pointerType);
    this.x = pointer.x;
    this.y = pointer.y;

    const lines = [`${pointer.pointerType} #${pointer.id}`, `(${Math.round(pointer.x)}, ${Math.round(pointer.y)})`];

    this._labelTexture.clear();
    lines.forEach((line, index) => {
      this._labelTexture.drawText({
        text: line,
        x: 0,
        y: index * 14,
        font: { family: FONT_NAME, size: 12 },
        color: POINTER_VISUAL_CONFIG[pointer.pointerType].color,
      });
    });
  }

  private _syncPointerType(pointerType: PointerKind) {
    if (this._type === pointerType) {
      return;
    }

    this._type = pointerType;
    this._cursorSprite.setFrame({
      x: this._cursorImageFrameX(pointerType),
      y: 0,
      width: this._cursorImageWidth,
      height: this._cursorImageWidth,
    });
  }

  private _cursorImageFrameX(pointerType: PointerKind) {
    return POINTER_VISUAL_CONFIG[pointerType].frameIndex * this._cursorImageWidth;
  }
}
