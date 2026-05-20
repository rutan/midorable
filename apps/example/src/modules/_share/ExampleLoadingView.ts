import { DisplayObject, Sprite, type DisplayObjectProps } from '@rutan/midorable';
import type { SceneLoadingState } from '@rutan/midorable/utils/scene';
import type { SceneMap } from './scenes';
import { TextButtonSprite } from './sprites';

const PROGRESS_BAR_WIDTH = 300;
const PROGRESS_BAR_HEIGHT = 40;

const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 64;

export class ExampleLoadingView extends DisplayObject {
  private _backgroundSprite!: Sprite;
  private _progressBarSprite!: Sprite;
  private _retryButton!: TextButtonSprite;
  private _retryAction: (() => Promise<void>) | null = null;

  constructor(props: DisplayObjectProps) {
    super({ ...props, visible: false, interactive: true, cursor: 'default' });

    this._createBackgroundSprite();
    this._createProgressBarSprite();
    this._createRetryButton();
  }

  private _createBackgroundSprite() {
    const texture = this.context.app.createTexture(this.context.app.width, this.context.app.height);
    texture.drawRect({
      x: 0,
      y: 0,
      width: this.context.app.width,
      height: this.context.app.height,
      color: { r: 0, g: 0, b: 0, a: 0.55 },
    });
    this._backgroundSprite = new Sprite({
      context: this.context,
      image: texture,
    });
    this.addChild(this._backgroundSprite);
  }

  private _createProgressBarSprite() {
    const texture = this.context.app.createTexture(PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT);
    texture.drawRect({
      x: 0,
      y: 0,
      width: PROGRESS_BAR_WIDTH,
      height: PROGRESS_BAR_HEIGHT,
      color: { r: 32, g: 255, b: 128, a: 1 },
    });
    this._progressBarSprite = new Sprite({
      context: this.context,
      image: texture,
      anchorX: 0,
      anchorY: 0.5,
      x: (this.context.app.width - PROGRESS_BAR_WIDTH) / 2,
      y: this.context.app.height / 2 - 36,
      scaleX: 0,
    });
    this.addChild(this._progressBarSprite);
  }

  private _createRetryButton() {
    this._retryButton = new TextButtonSprite({
      context: this.context,
      label: 'Retry',
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      x: (this.context.app.width - BUTTON_WIDTH) / 2,
      y: this.context.app.height / 2 + 48,
      visible: false,
    });
    this._retryButton.onClickButton.on(() => {
      this._retryAction?.().catch((error) => {
        console.error('Retry action failed', error);
      });
    });
    this.addChild(this._retryButton);
  }

  getLocalBounds() {
    return {
      x: 0,
      y: 0,
      width: this.context.app.width,
      height: this.context.app.height,
    };
  }

  setState(state: SceneLoadingState<SceneMap>) {
    switch (state.status) {
      case 'hidden':
        this.hide();
        this._retryAction = null;
        this._progressBarSprite.scaleX = 0;
        this._retryButton.hide();
        return;
      case 'loading':
        this.show();
        const loading = state.assetLoading;
        if (loading) {
          this._updateProgressBar(loading.progress.completed / loading.progress.total);
        }
        this._retryAction = null;
        this._retryButton.hide();
        return;
      case 'failed':
        this.show();
        this._retryAction = state.retry;
        this._retryButton.show();
        return;
    }
  }

  private _updateProgressBar(progress: number) {
    this._progressBarSprite.scaleX = progress;
  }
}
