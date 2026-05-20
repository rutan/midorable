import {
  audioAsset,
  binaryAsset,
  DisplayObject,
  DisplayObjectProps,
  imageAsset,
  Sprite,
  textAsset,
  Texture,
} from '@rutan/midorable';
import { FONT_NAME, TextButtonSprite } from '../_share';

export interface LoadSpriteProps extends DisplayObjectProps {
  type: 'image' | 'audio' | 'text' | 'binary';
  key?: string;
  url: string;
}

const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 56;

export class LoadSprite extends DisplayObject {
  private _type: 'image' | 'audio' | 'text' | 'binary';
  private _key: string;
  private _url: string;
  private _loading = false;
  private _errorMessage: string | null = null;

  private _labelTexture!: Texture;
  private _labelSprite!: Sprite;

  private _loadButton!: TextButtonSprite;
  private _unloadButton!: TextButtonSprite;

  constructor(props: LoadSpriteProps) {
    super(props);
    this._type = props.type;
    this._key = props.key ?? props.url;
    this._url = props.url;

    this._createLabelSprite();
    this._createButtons();
    this._refreshLabel();
  }

  private _createLabelSprite() {
    this._labelTexture = this.context.app.createTexture(320, 60);
    this._labelSprite = new Sprite({
      context: this.context,
      image: this._labelTexture,
    });
    this.addChild(this._labelSprite);
  }

  private _createButtons() {
    this._loadButton = new TextButtonSprite({
      context: this.context,
      label: 'Load',
      x: this._labelTexture.width + 10,
      y: this._labelTexture.height / 2 - BUTTON_HEIGHT / 2,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    });
    this._loadButton.onClickButton.on(this._handleLoadClick);
    this.addChild(this._loadButton);

    this._unloadButton = new TextButtonSprite({
      context: this.context,
      label: 'Unload',
      x: this._loadButton.x + BUTTON_WIDTH + 5,
      y: this._loadButton.y,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
    });
    this._unloadButton.onClickButton.on(this._handleUnloadClick);
    this.addChild(this._unloadButton);

    this._refreshButtons();
  }

  dispose() {
    this._labelTexture.dispose();
    super.dispose();
  }

  private _refreshLabel() {
    this._labelTexture.clear();

    const lines = [`Type: ${this._type}`, this._getStatusText()];

    const lineHeight = this._labelTexture.height / lines.length;

    lines.forEach((line, index) => {
      this._labelTexture.drawText({
        text: line,
        x: 0,
        y: 0 + index * lineHeight,
        lineHeight,
        font: {
          family: FONT_NAME,
          size: 22,
        },
        color: { r: 255, g: 255, b: 255, a: 1 },
      });
    });
  }

  private _getStatusText() {
    if (this._loading) {
      return 'Status: Loading...';
    }

    if (this._errorMessage) {
      return `Status: Error - ${this._errorMessage}`;
    }

    return this._hasLoadedAsset() ? `Status: Loaded (${this._key})` : 'Status: Not loaded';
  }

  private _hasLoadedAsset() {
    return this.context.loader.get(this._key) !== undefined;
  }

  private _refreshButtons() {
    const hasLoadedAsset = this._hasLoadedAsset();

    this._loadButton.interactive = !this._loading && !hasLoadedAsset;
    this._loadButton.opacity = this._loadButton.interactive ? 1 : 0.5;

    this._unloadButton.interactive = !this._loading && hasLoadedAsset;
    this._unloadButton.opacity = this._unloadButton.interactive ? 1 : 0.5;
  }

  private _handleLoadClick = async () => {
    if (this._loading || this._hasLoadedAsset()) {
      return;
    }

    this._loading = true;
    this._errorMessage = null;
    this._refreshButtons();
    this._refreshLabel();

    try {
      switch (this._type) {
        case 'image':
          await this.context.loader.load(imageAsset(this._url), { key: this._key });
          break;
        case 'audio':
          await this.context.loader.load(audioAsset(this._url), { key: this._key });
          break;
        case 'text':
          await this.context.loader.load(textAsset(this._url), { key: this._key });
          break;
        case 'binary':
          await this.context.loader.load(binaryAsset(this._url), { key: this._key });
          break;
      }
    } catch (error) {
      this._errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
      this._refreshButtons();
      this._refreshLabel();
    }
  };

  private _handleUnloadClick = async () => {
    if (this._loading || !this._hasLoadedAsset()) {
      return;
    }

    this._loading = true;
    this._errorMessage = null;
    this._refreshButtons();
    this._refreshLabel();

    try {
      const asset = this.context.loader.get(this._key);
      if (asset) {
        await this.context.loader.unload(asset);
      }
    } catch (error) {
      this._errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
      this._refreshButtons();
      this._refreshLabel();
    }
  };
}
