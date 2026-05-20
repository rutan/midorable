import { Align, Color, Font, RenderableImage } from '@rutan/midorable';
import { colorToCss, fontToCss } from './utils';

type SourceImage = HTMLImageElement | HTMLCanvasElement;
type SizeProvider = () => { width: number; height: number };
type ResolveImageSource = (image: RenderableImage) => CanvasImageSource | null;

export function resolveCanvasImageSourceDefault(image: RenderableImage): CanvasImageSource | null {
  const source = image.source;
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
    return source;
  }
  return null;
}

export class Canvas2DTextureSurface {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _sourceImage: SourceImage | null;
  private readonly _getSize: SizeProvider;
  private readonly _onDirty: () => void;
  private readonly _resolveImageSource: ResolveImageSource;

  constructor(params: {
    getSize: SizeProvider;
    sourceImage?: SourceImage;
    onDirty?: () => void;
    resolveImageSource?: ResolveImageSource;
  }) {
    this._getSize = params.getSize;
    this._sourceImage = params.sourceImage ?? null;
    this._onDirty = params.onDirty ?? (() => undefined);
    this._resolveImageSource = params.resolveImageSource ?? resolveCanvasImageSourceDefault;
  }

  get source(): SourceImage | null {
    return this._canvas ?? this._sourceImage;
  }

  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  ensureCanvas(): HTMLCanvasElement | null {
    if (this._canvas) {
      return this._canvas;
    }
    const { width, height } = this._getSize();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    if (this._sourceImage && this._ctx) {
      this._ctx.drawImage(this._sourceImage, 0, 0, width, height);
      this._sourceImage = null;
    }
    return this._canvas;
  }

  dispose(): void {
    if (this._canvas) {
      this._canvas.width = 0;
      this._canvas.height = 0;
    }
    this._canvas = null;
    this._ctx = null;
    this._sourceImage = null;
  }

  drawLine(params: { sx: number; sy: number; ex: number; ey: number; color: Color; lineWidth?: number }) {
    if (!this.ensureCanvas() || !this._ctx) {
      return;
    }
    const { sx, sy, ex, ey, color, lineWidth = 1 } = params;
    this._ctx.save();
    this._ctx.strokeStyle = colorToCss(color);
    this._ctx.lineWidth = lineWidth;
    this._ctx.beginPath();
    this._ctx.moveTo(sx, sy);
    this._ctx.lineTo(ex, ey);
    this._ctx.stroke();
    this._ctx.restore();
    this._onDirty();
  }

  drawRect(params: { x: number; y: number; width: number; height: number; color: Color; fill?: boolean }) {
    if (!this.ensureCanvas() || !this._ctx) {
      return;
    }
    const { x, y, width, height, color, fill = true } = params;
    this._ctx.save();
    if (fill) {
      this._ctx.fillStyle = colorToCss(color);
      this._ctx.fillRect(x, y, width, height);
    } else {
      this._ctx.strokeStyle = colorToCss(color);
      this._ctx.lineWidth = 1;
      this._ctx.strokeRect(x, y, width, height);
    }
    this._ctx.restore();
    this._onDirty();
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
    if (!this.ensureCanvas() || !this._ctx) {
      return;
    }
    const source = this._resolveImageSource(params.image);
    if (!source) {
      return;
    }
    const sw = params.sw ?? params.image.width;
    const sh = params.sh ?? params.image.height;
    const dw = params.dw ?? sw;
    const dh = params.dh ?? sh;
    this._ctx.drawImage(source, params.sx, params.sy, sw, sh, params.dx, params.dy, dw, dh);
    this._onDirty();
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
    if (!this.ensureCanvas() || !this._ctx) {
      return;
    }
    const { text, x, y, font, color, lineHeight, align = 'left', maxWidth, outlineWidth = 0, outlineColor } = params;
    this._ctx.save();
    this._ctx.font = fontToCss(font);
    const metrics = this._ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent ?? font.size;
    const descent = metrics.actualBoundingBoxDescent ?? 0;
    const textHeight = ascent + descent;
    const lineTopOffset = lineHeight === undefined ? 0 : (lineHeight - textHeight) / 2;
    const drawY = y + lineTopOffset + ascent;
    this._ctx.fillStyle = colorToCss(color);
    this._ctx.textAlign = align;
    this._ctx.textBaseline = 'alphabetic';
    if (outlineWidth > 0) {
      this._ctx.lineWidth = outlineWidth;
      this._ctx.strokeStyle = colorToCss(outlineColor ?? color);
      this._ctx.lineJoin = 'round';
      if (maxWidth === undefined) {
        this._ctx.strokeText(text, x, drawY);
      } else {
        this._ctx.strokeText(text, x, drawY, maxWidth);
      }
    }
    if (maxWidth === undefined) {
      this._ctx.fillText(text, x, drawY);
    } else {
      this._ctx.fillText(text, x, drawY, maxWidth);
    }
    this._ctx.restore();
    this._onDirty();
  }

  measureText(params: { text: string; font: Font; maxWidth?: number }) {
    if (!this.ensureCanvas() || !this._ctx) {
      return { width: 0, height: 0 };
    }
    const { text, font, maxWidth } = params;
    this._ctx.save();
    this._ctx.font = fontToCss(font);
    const metrics = this._ctx.measureText(text);
    const rawWidth = metrics.width;
    const width = maxWidth === undefined ? rawWidth : Math.min(rawWidth, maxWidth);
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const height = ascent !== undefined && descent !== undefined ? ascent + descent : font.size;
    this._ctx.restore();
    return { width, height };
  }

  clear() {
    if (!this.ensureCanvas() || !this._ctx) {
      return;
    }
    const { width, height } = this._getSize();
    this._ctx.clearRect(0, 0, width, height);
    this._onDirty();
  }
}
