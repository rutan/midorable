import { AudioAsset, AudioInstance, DisplayObject, DisplayObjectProps, Sprite, Texture } from '@rutan/midorable';
import { FONT_NAME, TextButtonSprite } from '../_share';

export interface AudioPlayerSpriteProps extends DisplayObjectProps {
  name: string;
  audio: AudioAsset;
  loop?: boolean;
}

const LABEL_WIDTH = 420;
const LABEL_HEIGHT = 56;
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 56;
const BUTTON_GAP = 8;
const BUTTON_TOP = 68;
const PARAM_STEP_VOLUME = 0.1;
const PARAM_STEP_RATE = 0.1;
const PARAM_STEP_PAN = 0.1;

export class AudioPlayerSprite extends DisplayObject {
  private _name: string;
  private _audio: AudioAsset;
  private _loop: boolean;
  private _instance: AudioInstance | null = null;
  private _volume = 1;
  private _rate = 1;
  private _pan = 0;

  private _labelTexture!: Texture;
  private _labelSprite!: Sprite;

  constructor(props: AudioPlayerSpriteProps) {
    super(props);
    this._name = props.name;
    this._audio = props.audio;
    this._loop = props.loop ?? false;

    this._createLabelSprite();
    this._createButtons();
    this._refreshLabel();
  }

  get audio() {
    return this._audio;
  }

  dispose() {
    this._stop();
    this._labelTexture.dispose();
    super.dispose();
  }

  private _createLabelSprite() {
    this._labelTexture = this.context.app.createTexture(LABEL_WIDTH, LABEL_HEIGHT);
    this._labelSprite = new Sprite({
      context: this.context,
      image: this._labelTexture,
    });
    this.addChild(this._labelSprite);
  }

  private _createButtons() {
    const rows = [
      [
        { label: 'Play', onClick: () => this._play() },
        { label: 'Stop', onClick: () => this._stop() },
        { label: 'Vol -', onClick: () => this._changeVolume(-PARAM_STEP_VOLUME) },
        { label: 'Vol +', onClick: () => this._changeVolume(PARAM_STEP_VOLUME) },
      ],
      [
        { label: 'Pitch -', onClick: () => this._changeRate(-PARAM_STEP_RATE) },
        { label: 'Pitch +', onClick: () => this._changeRate(PARAM_STEP_RATE) },
        { label: 'Pan -', onClick: () => this._changePan(-PARAM_STEP_PAN) },
        { label: 'Pan +', onClick: () => this._changePan(PARAM_STEP_PAN) },
      ],
    ] as const;

    rows.forEach((row, rowIndex) => {
      row.forEach((buttonProps, columnIndex) => {
        const button = new TextButtonSprite({
          context: this.context,
          label: buttonProps.label,
          width: BUTTON_WIDTH,
          height: BUTTON_HEIGHT,
          x: columnIndex * (BUTTON_WIDTH + BUTTON_GAP),
          y: BUTTON_TOP + rowIndex * (BUTTON_HEIGHT + BUTTON_GAP),
        });
        button.onClickButton.on(buttonProps.onClick);
        this.addChild(button);
      });
    });
  }

  private _refreshLabel() {
    const lines = [
      `${this._name} ${this._loop ? '(loop)' : ''}`.trim(),
      `volume: ${this._volume.toFixed(1)}  pitch: ${this._rate.toFixed(1)}  pan: ${this._pan.toFixed(1)}`,
    ];

    const lineHeight = this._labelTexture.height / lines.length;
    this._labelTexture.clear();
    lines.forEach((text, index) => {
      this._labelTexture.drawText({
        text,
        x: 0,
        y: index * lineHeight,
        font: {
          family: FONT_NAME,
          size: 22,
        },
        lineHeight: lineHeight,
        color: { r: 255, g: 255, b: 255, a: 1 },
      });
    });
  }

  private _play() {
    this._stop();
    this._instance = this.context.app.audio.play(this._audio, {
      loop: this._loop,
      volume: this._volume,
      rate: this._rate,
      pan: this._pan,
    });
  }

  private _stop() {
    if (!this._instance) {
      return;
    }
    this.context.app.audio.stop(this._instance);
    this._instance = null;
  }

  private _changeVolume(delta: number) {
    this._volume = Math.min(Math.max(this._volume + delta, 0), 1);
    this._updatePlayback();
  }

  private _changeRate(delta: number) {
    this._rate = Math.min(Math.max(this._rate + delta, 0.5), 2);
    this._updatePlayback();
  }

  private _changePan(delta: number) {
    this._pan = Math.min(Math.max(this._pan + delta, -1), 1);
    this._updatePlayback();
  }

  private _updatePlayback() {
    if (this._instance) {
      this.context.app.audio.updatePlayback(this._instance, {
        volume: this._volume,
        rate: this._rate,
        pan: this._pan,
      });
    }
    this._refreshLabel();
  }
}
