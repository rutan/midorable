import { DisplayObject, type DisplayObjectProps } from '@rutan/midorable';
import { FONT_NAME, sceneRouter, TextButtonSprite } from '../_share';
import { LogScreenSprite } from './LogScreenSprite';

const BUTTON_WIDTH = 180;
const BUTTON_HEIGHT = 56;
const BUTTON_GAP = 14;
const BUTTON_START_X = 40;
const BUTTON_START_Y = 80;
const BUTTON_COLUMN_COUNT = 2;
const STORAGE_KEY = 'feature-demo-text';

export const FeatureSceneDef = sceneRouter.defineScene('feature', {
  create({ context }) {
    return new FeatureSceneView({ context });
  },
});

// StandardPlatformFeature の機能を使用するための表示オブジェクト
export class FeatureSceneView extends DisplayObject {
  private _logScreenSprite!: LogScreenSprite;

  constructor(props: DisplayObjectProps) {
    super(props);

    this._createLogScreenSprite();
    this._createButtons();
  }

  private _createLogScreenSprite() {
    this._logScreenSprite = new LogScreenSprite({
      context: this.context,
      x: 440,
      y: 60,
      width: this._context.app.width - 440 - 40,
      height: this._context.app.height - 60 - 40,
      font: {
        family: FONT_NAME,
        size: 20,
      },
      lineHeight: 30,
    });
    this.addChild(this._logScreenSprite);
  }

  private _createButtons() {
    const buttons = [
      {
        label: 'Locale',
        enabled: this.context.app.getFeature('system.locale') !== undefined,
        onClick: () => this._handleLocaleClick(),
      },
      {
        label: 'Font',
        enabled: this.context.app.getFeature('system.font') !== undefined,
        onClick: () => this._handleFontClick(),
      },
      {
        label: 'Open URL',
        enabled: this.context.app.getFeature('system.openUrl') !== undefined,
        onClick: () => this._handleOpenUrlClick(),
      },
      {
        label: 'Storage',
        enabled: this.context.app.getFeature('system.storage') !== undefined,
        onClick: () => this._handleStorageClick(),
      },
      {
        label: 'Clipboard',
        enabled: this.context.app.getFeature('system.clipboard') !== undefined,
        onClick: () => this._handleClipboardClick(),
      },
      {
        label: 'Share',
        enabled: this.context.app.getFeature('system.share') !== undefined,
        onClick: () => this._handleShareClick(),
      },
      {
        label: 'Prompt',
        enabled: this.context.app.getFeature('system.promptInput') !== undefined,
        onClick: () => this._handlePromptClick(),
      },
      {
        label: 'Exit',
        enabled: this.context.app.getFeature('system.exit') !== undefined,
        onClick: () => this._handleExitClick(),
      },
    ] as const;

    buttons.forEach((buttonProps, index) => {
      const column = index % BUTTON_COLUMN_COUNT;
      const row = Math.floor(index / BUTTON_COLUMN_COUNT);
      const button = new TextButtonSprite({
        context: this.context,
        label: buttonProps.label,
        x: BUTTON_START_X + column * (BUTTON_WIDTH + BUTTON_GAP),
        y: BUTTON_START_Y + row * (BUTTON_HEIGHT + BUTTON_GAP),
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
      });
      button.interactive = buttonProps.enabled;
      button.opacity = buttonProps.enabled ? 1 : 0.5;
      button.onClickButton.on(buttonProps.onClick);
      this.addChild(button);
    });
  }

  private async _handleLocaleClick() {
    const localeFeature = this.context.app.getFeature('system.locale');
    if (!localeFeature) {
      this._logScreenSprite.writeLine('system.locale is not supported.');
      return;
    }

    this._logScreenSprite.writeLine('system.locale');
    this._logScreenSprite.writeLine(`locale: ${localeFeature.getLocale()}`);
    this._logScreenSprite.writeLine(`timeZone: ${localeFeature.getTimeZone()}`);
  }

  private async _handleFontClick() {
    const fontFeature = this.context.app.getFeature('system.font');
    if (!fontFeature) {
      this._logScreenSprite.writeLine('system.font is not supported.');
      return;
    }

    const loaded = await fontFeature.loadFont(`${FONT_NAME}-FeatureDemo`, './fonts/MPLUSRounded1c-Regular.ttf');
    this._logScreenSprite.writeLine('system.font');
    this._logScreenSprite.writeLine(`loaded: ${loaded ? 'success' : 'failed'}`);
    this._logScreenSprite.writeLine(`fontName: ${FONT_NAME}-FeatureDemo`);
  }

  private async _handleOpenUrlClick() {
    const openUrlFeature = this.context.app.getFeature('system.openUrl');
    if (!openUrlFeature) {
      this._logScreenSprite.writeLine('system.openUrl is not supported.');
      return;
    }

    const opened = await openUrlFeature('https://github.com/rutan/midorable');
    this._logScreenSprite.writeLine('system.openUrl');
    this._logScreenSprite.writeLine(`result: ${opened ? 'success' : 'failed'}`);
    this._logScreenSprite.writeLine('url: https://github.com/rutan/midorable');
  }

  private async _handleStorageClick() {
    const storageFeature = this.context.app.getFeature('system.storage');
    if (!storageFeature) {
      this._logScreenSprite.writeLine('system.storage is not supported.');
      return;
    }

    const value = `saved at ${new Date().toLocaleTimeString()}`;
    await storageFeature.setItem(STORAGE_KEY, value);
    const loadedValue = await storageFeature.getItem(STORAGE_KEY);

    this._logScreenSprite.writeLine('system.storage');
    this._logScreenSprite.writeLine(`key: ${STORAGE_KEY}`);
    this._logScreenSprite.writeLine(`value: ${loadedValue ?? 'null'}`);
  }

  private async _handleClipboardClick() {
    const clipboardFeature = this.context.app.getFeature('system.clipboard');
    if (!clipboardFeature) {
      this._logScreenSprite.writeLine('system.clipboard is not supported.');
      return;
    }

    const value = `Copied from Midorable at ${new Date().toLocaleTimeString()}`;
    await clipboardFeature.writeText(value);
    const readValue = await clipboardFeature.readText();

    this._logScreenSprite.writeLine('system.clipboard');
    this._logScreenSprite.writeLine(`write: ${value}`);
    this._logScreenSprite.writeLine(`read: ${readValue}`);
  }

  private async _handleShareClick() {
    const shareFeature = this.context.app.getFeature('system.share');
    if (!shareFeature) {
      this._logScreenSprite.writeLine('system.share is not supported.');
      return;
    }

    await shareFeature.share({
      title: 'Midorable Feature Demo',
      text: 'StandardPlatformFeature demo',
      url: globalThis.location?.href,
    });

    this._logScreenSprite.writeLine('system.share');
    this._logScreenSprite.writeLine('share request sent.');
  }

  private async _handlePromptClick() {
    const promptInputFeature = this.context.app.getFeature('system.promptInput');
    if (!promptInputFeature) {
      this._logScreenSprite.writeLine('system.promptInput is not supported.');
      return;
    }

    const value = await promptInputFeature({
      title: 'Input text',
      defaultValue: 'Hello from Midorable',
      submitLabel: 'OK',
      cancelLabel: 'Cancel',
    });

    this._logScreenSprite.writeLine('system.promptInput');
    this._logScreenSprite.writeLine(`result: ${value ?? '(cancelled)'}`);
  }

  private async _handleExitClick() {
    const exitFeature = this.context.app.getFeature('system.exit');
    if (!exitFeature) {
      this._logScreenSprite.writeLine('system.exit is not supported.');
      return;
    }

    const result = await exitFeature(0);
    this._logScreenSprite.writeLine('system.exit');
    this._logScreenSprite.writeLine(`result: ${result ? 'success' : 'failed'}`);
  }
}
