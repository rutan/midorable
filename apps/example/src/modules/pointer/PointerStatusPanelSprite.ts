import { PointerButtonId, Sprite, Texture, SpriteProps } from '@rutan/midorable';
import { FONT_NAME } from '../_share';
import { PointerSnapshot } from './snapshot';

const POINTER_STATUS_TEXTURE_WIDTH = 360;
const POINTER_STATUS_TEXTURE_HEIGHT = 60;

export type PointerStatusPanelSpriteProps = Omit<SpriteProps, 'image'>;

export class PointerStatusPanelSprite extends Sprite {
  private _statusCacheKey = '';

  constructor(params: PointerStatusPanelSpriteProps) {
    const texture = params.context.app.createTexture(POINTER_STATUS_TEXTURE_WIDTH, POINTER_STATUS_TEXTURE_HEIGHT);
    super({
      ...params,
      image: texture,
    });
  }

  setSnapshot(snapshot: PointerSnapshot) {
    const texture = this.image as Texture;

    const { counts, mouseButtons } = snapshot;
    const lines = [
      `Mouse: L[${this._toButtonState(mouseButtons, 'left')}] M[${this._toButtonState(mouseButtons, 'middle')}] R[${this._toButtonState(mouseButtons, 'right')}]`,
      `Touch: ${counts.touch}  Pen: ${counts.pen}  Total: ${counts.total}`,
    ];
    const cacheKey = lines.join('\n');
    if (cacheKey === this._statusCacheKey) {
      return;
    }

    this._statusCacheKey = cacheKey;

    texture.clear();
    lines.forEach((text, index) => {
      texture.drawText({
        text,
        x: 0,
        y: index * 30,
        lineHeight: 30,
        font: { family: FONT_NAME, size: 20 },
        color: { r: 255, g: 255, b: 255, a: 1 },
        align: 'left',
      });
    });
  }

  private _toButtonState(buttons: Set<PointerButtonId>, button: PointerButtonId) {
    return buttons.has(button) ? 'down' : 'up';
  }
}
