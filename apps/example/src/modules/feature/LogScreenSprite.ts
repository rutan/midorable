import { DisplayObjectProps, Font, Sprite, Texture } from '@rutan/midorable';

export interface LogScreenSpriteProps extends DisplayObjectProps {
  width: number;
  height: number;
  font: Font;
  lineHeight: number;
}

export class LogScreenSprite extends Sprite {
  private _font: Font;
  private _lines: string[] = [];
  private _lineHeight: number;

  constructor(props: LogScreenSpriteProps) {
    super({
      ...props,
      image: props.context.app.createTexture(props.width, props.height),
    });
    this._font = props.font;
    this._lineHeight = props.lineHeight;

    this._refresh();
  }

  writeLine(line: string) {
    const date = new Date();
    const timestamp = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    this._lines.push(` [${timestamp}]\t${line}`);
    this._refresh();
  }

  private _refresh() {
    const texture = this.image as Texture;
    texture.clear();

    // border + background
    texture.drawRect({
      x: 0,
      y: 0,
      width: texture.width,
      height: texture.height,
      color: { r: 32, g: 32, b: 128, a: 0.2 },
      fill: true,
    });
    texture.drawRect({
      x: 0,
      y: 0,
      width: texture.width,
      height: texture.height,
      color: { r: 255, g: 255, b: 255, a: 1 },
      fill: false,
    });

    // text
    const maxLines = Math.floor(texture.height / this._lineHeight) - 1;
    const startLine = Math.max(0, this._lines.length - maxLines);
    this._lines.slice(startLine).forEach((line, index) => {
      texture.drawText({
        text: line,
        x: 12,
        y: 12 + index * this._lineHeight,
        lineHeight: this._lineHeight,
        font: this._font,
        color: { r: 255, g: 255, b: 255, a: 1 },
      });
    });
  }
}
