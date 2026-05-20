import { Color, FilterInstance, Rectangle, RenderableImage, Renderer, RenderState } from '@rutan/midorable';
import { clamp01, clamp255 } from '../internal/utilities';
import { colorToCss } from '../utils';

export class CanvasRenderer implements Renderer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _baseCtx: CanvasRenderingContext2D | null = null;
  private _toneCanvas: HTMLCanvasElement | null = null;
  private _toneCtx: CanvasRenderingContext2D | null = null;
  private _maskStack: {
    contentCanvas: HTMLCanvasElement;
    contentCtx: CanvasRenderingContext2D;
    maskCanvas: HTMLCanvasElement;
    maskCtx: CanvasRenderingContext2D;
    parentCtx: CanvasRenderingContext2D;
  }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
  }

  beginFrame() {
    if (!this._ctx) {
      this._baseCtx = this._canvas.getContext('2d');
      this._ctx = this._baseCtx;
    }
  }

  endFrame() {}

  clear(color: Color = { r: 0, g: 0, b: 0, a: 1 }) {
    if (!this._ctx) {
      return;
    }
    this._ctx.save();
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._ctx.globalAlpha = 1;
    this._ctx.fillStyle = colorToCss(color);
    this._ctx.fillRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);
    this._ctx.restore();
  }

  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null) {
    if (!this._ctx) {
      return;
    }
    const source = image.source;
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return;
    }

    const { a, b, c, d, tx, ty } = state.transform;
    this._ctx.save();
    this._ctx.setTransform(a, b, c, d, tx, ty);
    this._ctx.globalAlpha = state.alpha;
    this._ctx.globalCompositeOperation = blendModeToComposite(state.blendMode);
    this._ctx.imageSmoothingEnabled = state.smooth;

    const toneAlpha = clamp01(state.colorTone.a);
    if (toneAlpha > 0) {
      const sw = frame?.width ?? image.width;
      const sh = frame?.height ?? image.height;
      const toneSurface = this.ensureToneSurface(sw, sh);
      if (toneSurface) {
        const { canvas, ctx } = toneSurface;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = state.smooth;
        ctx.clearRect(0, 0, sw, sh);
        if (frame) {
          ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
        } else {
          ctx.drawImage(source, 0, 0);
        }
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgb(${Math.round(clamp255(state.colorTone.r))}, ${Math.round(clamp255(state.colorTone.g))}, ${Math.round(clamp255(state.colorTone.b))})`;
        ctx.globalAlpha = toneAlpha;
        ctx.fillRect(0, 0, sw, sh);
        ctx.restore();
        this._ctx.drawImage(canvas, 0, 0);
      }
    } else if (frame) {
      this._ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    } else {
      this._ctx.drawImage(source, 0, 0);
    }

    this._ctx.restore();
  }

  pushFilters(_filters: readonly FilterInstance[], _state: RenderState): boolean {
    return false;
  }

  popFilters() {}

  pushMask() {
    if (!this._ctx || !this._baseCtx) {
      return;
    }

    const contentCanvas = document.createElement('canvas');
    contentCanvas.width = this._baseCtx.canvas.width;
    contentCanvas.height = this._baseCtx.canvas.height;
    const contentCtx = contentCanvas.getContext('2d');
    if (!contentCtx) {
      return;
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = this._baseCtx.canvas.width;
    maskCanvas.height = this._baseCtx.canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) {
      return;
    }

    contentCtx.setTransform(1, 0, 0, 1, 0, 0);
    contentCtx.globalAlpha = 1;
    contentCtx.clearRect(0, 0, contentCanvas.width, contentCanvas.height);
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.globalAlpha = 1;
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

    this._maskStack.push({
      contentCanvas,
      contentCtx,
      maskCanvas,
      maskCtx,
      parentCtx: this._ctx,
    });
    this._ctx = contentCtx;
  }

  activateMask() {
    const entry = this._maskStack[this._maskStack.length - 1];
    if (!entry) {
      return;
    }
    this._ctx = entry.maskCtx;
  }

  popMask() {
    if (!this._ctx) {
      return;
    }

    const entry = this._maskStack.pop();
    if (!entry) {
      return;
    }

    const { contentCanvas, contentCtx, maskCanvas, parentCtx } = entry;
    contentCtx.save();
    contentCtx.setTransform(1, 0, 0, 1, 0, 0);
    contentCtx.globalAlpha = 1;
    contentCtx.globalCompositeOperation = 'destination-in';
    contentCtx.drawImage(maskCanvas, 0, 0);
    contentCtx.restore();

    parentCtx.save();
    parentCtx.setTransform(1, 0, 0, 1, 0, 0);
    parentCtx.globalAlpha = 1;
    parentCtx.drawImage(contentCanvas, 0, 0);
    parentCtx.restore();

    this._ctx = parentCtx;
  }

  resize(width: number, height: number) {
    this._canvas.width = width;
    this._canvas.height = height;
  }

  private ensureToneSurface(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      return null;
    }
    if (!this._toneCanvas) {
      this._toneCanvas = document.createElement('canvas');
      this._toneCtx = this._toneCanvas.getContext('2d');
    }
    if (!this._toneCanvas || !this._toneCtx) {
      return null;
    }
    if (this._toneCanvas.width !== width || this._toneCanvas.height !== height) {
      this._toneCanvas.width = width;
      this._toneCanvas.height = height;
    }
    return { canvas: this._toneCanvas, ctx: this._toneCtx };
  }
}

function blendModeToComposite(blendMode: RenderState['blendMode']): GlobalCompositeOperation {
  switch (blendMode) {
    case 'add':
      return 'lighter';
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    default:
      return 'source-over';
  }
}
