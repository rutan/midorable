import {
  Color,
  DrawTexturedTrianglesParams,
  FilterInstance,
  Rectangle,
  RenderState,
  RenderableImage,
  Renderer,
  RendererMeshFeature,
} from '@rutan/midorable';
import { HeadlessDrawCommand } from './types';

export class HeadlessRenderer implements Renderer, RendererMeshFeature {
  private _mode: 'noop' | 'record';
  private _commands: HeadlessDrawCommand[] = [];
  private _width = 0;
  private _height = 0;
  private _frameActive = false;

  constructor(mode: 'noop' | 'record' = 'noop') {
    this._mode = mode;
  }

  get commands(): readonly HeadlessDrawCommand[] {
    return this._commands;
  }

  get size() {
    return { width: this._width, height: this._height };
  }

  beginFrame(): void {
    this._frameActive = true;
  }

  endFrame(): void {
    this._frameActive = false;
  }

  clear(color: Color = { r: 0, g: 0, b: 0, a: 1 }): void {
    if (!this.shouldRecord()) {
      return;
    }
    this._commands.push({ type: 'clear', color: { r: color.r, g: color.g, b: color.b, a: color.a } });
  }

  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null): void {
    if (!this.shouldRecord()) {
      return;
    }
    if (!frame) {
      this._commands.push({ type: 'drawSprite', image, state });
      return;
    }
    this._commands.push({
      type: 'drawSpriteFrame',
      image,
      state,
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    });
  }

  drawTexturedTriangles(params: DrawTexturedTrianglesParams): void {
    if (!this.shouldRecord()) {
      return;
    }
    this._commands.push({
      type: 'drawTexturedTriangles',
      image: params.image,
      state: params.state,
      positions: Array.from(params.positions),
      uvs: Array.from(params.uvs),
      indices: Array.from(params.indices),
      tint: params.tint ? { ...params.tint } : undefined,
    });
  }

  pushFilters(_filters: readonly FilterInstance[], _state: RenderState): boolean {
    return false;
  }

  popFilters(): void {}

  pushMask(): void {
    if (!this.shouldRecord()) {
      return;
    }
    this._commands.push({ type: 'pushMask' });
  }

  activateMask(): void {
    if (!this.shouldRecord()) {
      return;
    }
    this._commands.push({ type: 'activateMask' });
  }

  popMask(): void {
    if (!this.shouldRecord()) {
      return;
    }
    this._commands.push({ type: 'popMask' });
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
  }

  resetCommands(): void {
    this._commands = [];
  }

  private shouldRecord(): boolean {
    return this._mode === 'record' && this._frameActive;
  }
}
