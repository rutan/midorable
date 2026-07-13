import { FilterResource, ShaderFilterDefinition } from '@rutan/midorable/platform';

export class WebGlFilterInstance implements FilterResource {
  readonly definition: ShaderFilterDefinition;
  program: WebGLProgram;
  aPositionLocation: number;
  aUvLocation: number;
  uTextureLocation: WebGLUniformLocation;
  uUniformsLocation: WebGLUniformLocation | null;
  private _disposed = false;
  private _onDispose: ((program: WebGLProgram) => void) | null;

  constructor(params: {
    definition: ShaderFilterDefinition;
    program: WebGLProgram;
    aPositionLocation: number;
    aUvLocation: number;
    uTextureLocation: WebGLUniformLocation;
    uUniformsLocation: WebGLUniformLocation | null;
    onDispose?: (program: WebGLProgram) => void;
  }) {
    this.definition = params.definition;
    this.program = params.program;
    this.aPositionLocation = params.aPositionLocation;
    this.aUvLocation = params.aUvLocation;
    this.uTextureLocation = params.uTextureLocation;
    this.uUniformsLocation = params.uUniformsLocation;
    this._onDispose = params.onDispose ?? null;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._onDispose?.(this.program);
    this._onDispose = null;
  }

  rebindProgram(params: {
    program: WebGLProgram;
    aPositionLocation: number;
    aUvLocation: number;
    uTextureLocation: WebGLUniformLocation;
    uUniformsLocation: WebGLUniformLocation | null;
  }): void {
    if (this._disposed) {
      return;
    }
    this.program = params.program;
    this.aPositionLocation = params.aPositionLocation;
    this.aUvLocation = params.aUvLocation;
    this.uTextureLocation = params.uTextureLocation;
    this.uUniformsLocation = params.uUniformsLocation;
  }
}
