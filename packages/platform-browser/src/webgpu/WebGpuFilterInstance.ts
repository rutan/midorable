import { FilterInstance, FilterUniformValue, ShaderFilterDefinition } from '@rutan/midorable';
import { WebGpuRenderer } from './WebGpuRenderer';

let globalFilterId = 0;

export class WebGpuFilterInstance implements FilterInstance {
  readonly id = `wgpu-filter-${(globalFilterId += 1)}`;
  readonly definition: ShaderFilterDefinition;
  readonly pipeline: GPURenderPipeline;
  enabled = true;
  private _disposed = false;
  private _uniformLayout = new Map<string, number>();
  private _uniformData: Float32Array;

  constructor(definition: ShaderFilterDefinition, pipeline: GPURenderPipeline) {
    this.definition = definition;
    this.pipeline = pipeline;
    this._uniformData = new Float32Array(WebGpuRenderer.FILTER_UNIFORM_VEC4_COUNT * 4);

    const initialUniforms = definition.uniforms ?? {};
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

  get uniformBufferData(): Float32Array {
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
    this._disposed = true;
    this.enabled = false;
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
    if (slot >= WebGpuRenderer.FILTER_UNIFORM_VEC4_COUNT) {
      throw new Error(`Too many uniforms. Max is ${WebGpuRenderer.FILTER_UNIFORM_VEC4_COUNT}.`);
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
