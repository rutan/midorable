import { Align, Color, Font, RenderableImage, Texture } from '@rutan/midorable';
import { Canvas2DTextureSurface, resolveCanvasImageSourceDefault } from '../Canvas2DTextureSurface';
import { GPU_TEXTURE_USAGE } from './WebGpuUsage';

export class WebGpuTexture implements Texture {
  width: number;
  height: number;
  source: GPUTexture;
  isShared = false;
  private _surface: Canvas2DTextureSurface;
  private _device: GPUDevice;
  private _dirty = false;

  constructor(device: GPUDevice, width: number, height: number, source?: HTMLImageElement | HTMLCanvasElement) {
    this._device = device;
    this.width = width;
    this.height = height;
    this._surface = new Canvas2DTextureSurface({
      getSize: () => ({ width: this.width, height: this.height }),
      sourceImage: source,
      onDirty: () => {
        this._dirty = true;
      },
      resolveImageSource: (image) => {
        if (image instanceof WebGpuTexture) {
          image.ensureCanvasElement();
          return image.getCanvasElement();
        }
        return resolveCanvasImageSourceDefault(image);
      },
    });
    this.source = device.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage: GPU_TEXTURE_USAGE.textureBinding | GPU_TEXTURE_USAGE.copyDst | GPU_TEXTURE_USAGE.renderAttachment,
    });
    if (source) {
      this._device.queue.copyExternalImageToTexture({ source }, { texture: this.source }, [width, height]);
    }
  }

  dispose() {
    this.source.destroy();
    this._surface.dispose();
    this._dirty = false;
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

  ensureUploaded() {
    const canvas = this._surface.canvas;
    if (!this._dirty || !canvas) {
      return;
    }
    this._device.queue.copyExternalImageToTexture({ source: canvas }, { texture: this.source }, [
      this.width,
      this.height,
    ]);
    this._dirty = false;
  }

  private ensureCanvasElement() {
    this._surface.ensureCanvas();
  }

  private getCanvasElement() {
    return this._surface.canvas;
  }
}
