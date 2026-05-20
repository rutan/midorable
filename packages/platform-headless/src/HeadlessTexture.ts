import { Align, Color, Font, RenderableImage, Size, Texture } from '@rutan/midorable';
import { HeadlessTextureCommand } from './types';

export class HeadlessTexture implements Texture {
  width: number;
  height: number;
  isShared: boolean;

  private _disposed = false;
  private _commands: HeadlessTextureCommand[] = [];
  private _recording: boolean;

  constructor(width: number, height: number, options?: { isShared?: boolean; recording?: boolean }) {
    this.width = width;
    this.height = height;
    this.isShared = options?.isShared ?? false;
    this._recording = options?.recording ?? false;
  }

  get source(): unknown {
    return null;
  }

  get commands(): readonly HeadlessTextureCommand[] {
    return this._commands;
  }

  dispose(): void {
    this._disposed = true;
    this._commands = [];
  }

  drawLine(params: { sx: number; sy: number; ex: number; ey: number; color: Color; lineWidth?: number }): void {
    if (!this._recording || this._disposed) {
      return;
    }
    this._commands.push({
      type: 'drawLine',
      sx: params.sx,
      sy: params.sy,
      ex: params.ex,
      ey: params.ey,
    });
  }

  drawRect(params: { x: number; y: number; width: number; height: number; color: Color; fill?: boolean }): void {
    if (!this._recording || this._disposed) {
      return;
    }
    this._commands.push({
      type: 'drawRect',
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height,
      fill: params.fill ?? true,
    });
  }

  drawText(params: {
    text: string;
    x: number;
    y: number;
    font: Font;
    color: Color;
    lineHeight?: number;
    align?: Align;
    maxWidth?: number;
    outlineWidth?: number;
    outlineColor?: Color;
  }): void {
    if (!this._recording || this._disposed) {
      return;
    }
    this._commands.push({
      type: 'drawText',
      text: params.text,
      x: params.x,
      y: params.y,
    });
  }

  measureText(params: { text: string; font: Font; maxWidth?: number }): Size {
    const approxWidth = Math.max(0, params.text.length * params.font.size * 0.5);
    return { width: approxWidth, height: params.font.size };
  }

  drawImage(params: {
    image: RenderableImage;
    sx: number;
    sy: number;
    sw?: number;
    sh?: number;
    dx: number;
    dy: number;
    dw?: number;
    dh?: number;
  }): void {
    if (!this._recording || this._disposed) {
      return;
    }
    const sw = params.sw ?? params.image.width;
    const sh = params.sh ?? params.image.height;
    this._commands.push({
      type: 'drawImage',
      sx: params.sx,
      sy: params.sy,
      sw,
      sh,
      dx: params.dx,
      dy: params.dy,
      dw: params.dw ?? sw,
      dh: params.dh ?? sh,
    });
  }

  clear(): void {
    if (!this._recording || this._disposed) {
      return;
    }
    this._commands.push({ type: 'clear' });
  }
}
