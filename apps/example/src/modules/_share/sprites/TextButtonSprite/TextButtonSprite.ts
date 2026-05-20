import {
  createEventHandlers,
  DisplayObject,
  DisplayObjectProps,
  type ImageAsset,
  NinePatch,
  Sprite,
  Texture,
} from '@rutan/midorable';
import { BUTTON_CORNER_SIZE, BUTTON_IMAGE_KEY, FONT_NAME } from '../../constants';

export interface TextButtonSpriteProps extends DisplayObjectProps {
  label: string;
  width: number;
  height: number;
}

export interface TextButtonClickEvent {
  type: 'click';
}

type ButtonState = 'default' | 'action';

export class TextButtonSprite extends DisplayObject {
  private _label: string;
  private _width: number;
  private _height: number;
  private _onClickButton = createEventHandlers<TextButtonClickEvent>();
  private _state: ButtonState = 'default';

  private _wrapperSprite!: DisplayObject;
  private _backSprite!: NinePatch;
  private _labelTexture!: Texture;
  private _labelSprite!: Sprite;

  constructor(props: TextButtonSpriteProps) {
    super(props);
    this._label = props.label;
    this._width = props.width;
    this._height = props.height;

    this._wrapperSprite = new DisplayObject({
      context: this._context,
      x: this._width / 2,
      y: this._height / 2,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this.addChild(this._wrapperSprite);

    this._createBackSprite();
    this._createLabelSprite();
    this._refreshLabel();

    this.interactive = true;
    this.onPointerDown.on(this._handlePointerDown);
    this.onPointerUp.on(this._handlePointerUp);
    this.onClick.on(() => {
      this._onClickButton.emit({ type: 'click' });
    });
  }

  dispose() {
    this._onClickButton.listeners.offAll();
    this._labelTexture.dispose();
    super.dispose();
  }

  get onClickButton() {
    return this._onClickButton.listeners;
  }

  get label() {
    return this._label;
  }

  set label(value: string) {
    if (this._label === value) return;
    this._label = value;
    this._refreshLabel();
  }

  getLocalBounds() {
    return {
      x: 0,
      y: 0,
      width: this._width,
      height: this._height,
    };
  }

  private _createBackSprite() {
    this._backSprite = new NinePatch({
      context: this._context,
      image: this._context.loader.get(BUTTON_IMAGE_KEY)! as ImageAsset,
      width: this._width,
      height: this._height,
      slice: {
        left: BUTTON_CORNER_SIZE,
        top: BUTTON_CORNER_SIZE,
        right: BUTTON_CORNER_SIZE,
        bottom: BUTTON_CORNER_SIZE,
      },
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this._wrapperSprite.addChild(this._backSprite);
  }

  private _createLabelSprite() {
    this._labelTexture = this._context.app.createTexture(this._width, this._height);
    this._labelSprite = new Sprite({
      context: this._context,
      image: this._labelTexture,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this._wrapperSprite.addChild(this._labelSprite);
  }

  private _refreshLabel() {
    this._labelTexture.clear();

    this._labelTexture.drawText({
      text: this._label,
      x: this._labelTexture.width / 2,
      y: 0,
      font: {
        family: FONT_NAME,
        size: 22,
      },
      color: { r: 255, g: 255, b: 255, a: 1 },
      lineHeight: this._height,
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 4,
      align: 'center',
    });
  }

  private _updateButtonStyle() {
    switch (this._state) {
      case 'default': {
        this._wrapperSprite.scaleX = 1;
        this._wrapperSprite.scaleY = 1;
        break;
      }
      case 'action': {
        this._wrapperSprite.scaleX = 0.95;
        this._wrapperSprite.scaleY = 0.95;
        break;
      }
    }
  }

  private _handlePointerDown = () => {
    this._state = 'action';
    this._updateButtonStyle();
  };

  private _handlePointerUp = () => {
    this._state = 'default';
    this._updateButtonStyle();
  };
}
