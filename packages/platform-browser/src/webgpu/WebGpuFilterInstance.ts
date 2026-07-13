import { FilterResource } from '@rutan/midorable/platform';

export class WebGpuFilterInstance implements FilterResource {
  readonly pipeline: GPURenderPipeline;
  private _disposed = false;

  constructor(pipeline: GPURenderPipeline) {
    this.pipeline = pipeline;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  dispose(): void {
    this._disposed = true;
  }
}
