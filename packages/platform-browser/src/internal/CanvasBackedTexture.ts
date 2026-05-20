import { Align, Color, Font, RenderableImage, Texture } from '@rutan/midorable';
import { Canvas2DTextureSurface } from '../Canvas2DTextureSurface';

export class CanvasBackedTexture implements Texture {
  width: number;
  height: number;
  isShared = false;
  private _surface: Canvas2DTextureSurface;

  constructor(width: number, height: number, source?: HTMLImageElement | HTMLCanvasElement) {
    this.width = width;
    this.height = height;
    this._surface = new Canvas2DTextureSurface({
      getSize: () => ({ width: this.width, height: this.height }),
      sourceImage: source,
    });

    if (!source) {
      this._surface.ensureCanvas();
    }
  }

  get source(): HTMLImageElement | HTMLCanvasElement {
    const resolved = this._surface.source;
    if (!resolved) {
      throw new Error('CanvasBackedTexture source is not initialized');
    }
    return resolved;
  }

  dispose() {
    this._surface.dispose();
  }

  drawLine(params: { sx: number; sy: number; ex: number; ey: number; color: Color; lineWidth?: number }) {
    this._surface.drawLine(params);
  }

  drawRect(params: { x: number; y: number; width: number; height: number; color: Color; fill?: boolean }) {
    this._surface.drawRect(params);
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
  }) {
    this._surface.drawImage(params);
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
  }) {
    this._surface.drawText(params);
  }

  measureText(params: { text: string; font: Font; maxWidth?: number }) {
    return this._surface.measureText(params);
  }

  clear() {
    this._surface.clear();
  }
}
