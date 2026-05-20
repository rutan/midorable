import { FilterInstance, FilterUniformValue, ShaderFilterDefinition } from '@rutan/midorable';
import { WebGlRenderer } from './WebGlRenderer';

let globalFilterId = 0;

export class WebGlFilterInstance implements FilterInstance {
  readonly id = `wgl-filter-${(globalFilterId += 1)}`;
  readonly definition: ShaderFilterDefinition;
  program: WebGLProgram;
  aPositionLocation: number;
  aUvLocation: number;
  uTextureLocation: WebGLUniformLocation;
  uUniformsLocation: WebGLUniformLocation | null;
  enabled = true;
  private _disposed = false;
  private _uniformLayout = new Map<string, number>();
  private _uniformData: Float32Array;
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
    this._uniformData = new Float32Array(WebGlRenderer.FILTER_UNIFORM_VEC4_COUNT * 4);

    const initialUniforms = this.definition.uniforms ?? {};
    let slot = 0;
    for (const [name, value] of Object.entries(initialUniforms)) {
      this._uniformLayout.set(name, this.assertUniformSlot(slot));
      this.writeVec4(slot, value);
      slot += 1;
    }
  }

  get isDisposed(): boolean {
    return this._disposed;
  }

  get uniformData(): Float32Array {
    return this._uniformData;
  }

  setUniform(name: string, value: FilterUniformValue): void {
    if (this._disposed) {
      throw new Error('Filter is already disposed');
    }
    const slot = this.ensureUniformSlot(name);
    this.writeVec4(slot, value);
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this.enabled = false;
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

  private ensureUniformSlot(name: string): number {
    const existing = this._uniformLayout.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const slot = this.assertUniformSlot(this._uniformLayout.size);
    this._uniformLayout.set(name, slot);
    return slot;
  }

  private assertUniformSlot(slot: number): number {
    if (slot >= WebGlRenderer.FILTER_UNIFORM_VEC4_COUNT) {
      throw new Error(`Too many uniforms. Max is ${WebGlRenderer.FILTER_UNIFORM_VEC4_COUNT}.`);
    }
    return slot;
  }

  private writeVec4(slot: number, value: FilterUniformValue) {
    const offset = slot * 4;
    this._uniformData.fill(0, offset, offset + 4);
    if (typeof value === 'number') {
      this._uniformData[offset] = value;
      return;
    }
    const length = Math.min(4, value.length);
    for (let index = 0; index < length; index += 1) {
      this._uniformData[offset + index] = value[index] ?? 0;
    }
  }
}
