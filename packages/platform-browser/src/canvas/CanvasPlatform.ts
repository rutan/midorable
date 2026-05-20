import { Renderer, Texture } from '@rutan/midorable';
import { BrowserPlatformBase, BrowserPlatformConfig } from '../BrowserPlatformBase';
import { CanvasBackedTexture } from '../internal/CanvasBackedTexture';
import { CanvasRenderer } from './CanvasRenderer';

export interface CanvasPlatformConfig extends BrowserPlatformConfig {}

export class CanvasPlatform extends BrowserPlatformBase {
  protected async createRenderer(canvas: HTMLCanvasElement): Promise<Renderer> {
    return new CanvasRenderer(canvas);
  }

  protected disposeRenderer(_renderer: Renderer | null): void {
    // noop
  }

  protected onResize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  protected createTextureCore(width: number, height: number): Texture {
    return new CanvasBackedTexture(width, height);
  }
}
