import { RenderCommand, RenderFrame, Renderer } from '@rutan/midorable/platform';

export class HeadlessRenderer implements Renderer {
  private _mode: 'noop' | 'record';
  private _lastFrame: RenderFrame | null = null;
  private _width = 0;
  private _height = 0;

  constructor(mode: 'noop' | 'record' = 'noop') {
    this._mode = mode;
  }

  get lastFrame(): RenderFrame | null {
    return this._lastFrame;
  }

  get commands(): readonly RenderCommand[] {
    return this._lastFrame?.commands ?? [];
  }

  get size() {
    return { width: this._width, height: this._height };
  }

  submitFrame(frame: RenderFrame): void {
    if (this._mode !== 'record') {
      return;
    }
    this._lastFrame = cloneFrame(frame);
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
  }
}

function cloneFrame(frame: RenderFrame): RenderFrame {
  return {
    clearColor: { ...frame.clearColor },
    commands: frame.commands.map((command): RenderCommand => {
      switch (command.type) {
        case 'spriteBatch':
          return { ...command, instanceData: command.instanceData.slice() };
        case 'drawTexturedTriangles':
          return {
            ...command,
            state: cloneState(command.state),
            positions: command.positions.slice(),
            uvs: command.uvs.slice(),
            indices: command.indices.slice(),
            tint: command.tint ? { ...command.tint } : undefined,
          };
        case 'pushFilters':
          return {
            ...command,
            state: cloneState(command.state),
            filters: command.filters.map((filter) => ({
              resource: filter.resource,
              uniformData: filter.uniformData.slice(),
            })),
          };
        default:
          return command;
      }
    }),
  };
}

function cloneState<T extends { transform: object; colorTone: object }>(state: T): T {
  return { ...state, transform: { ...state.transform }, colorTone: { ...state.colorTone } };
}
