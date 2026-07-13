import {
  Color,
  DrawTexturedTrianglesParams,
  FilterInstance,
  Rectangle,
  RenderCommand,
  RenderCommandEncoder,
  RenderFrame,
  RenderState,
  RenderableImage,
  SPRITE_INSTANCE_STRIDE,
  SpriteBatchCommand,
} from '../../platform';

interface SpriteBatchBuilder {
  command: SpriteBatchCommand;
  buffer: Float32Array;
  length: number;
}

export class DefaultRenderCommandEncoder implements RenderCommandEncoder {
  private _clearColor: Color = { r: 0, g: 0, b: 0, a: 1 };
  private _commands: RenderCommand[] = [];
  private _spriteBuffers: Float32Array[] = [];
  private _spriteBufferIndex = 0;
  private _currentSpriteBatch: SpriteBatchBuilder | null = null;
  private _filterStack: boolean[] = [];
  private _maskStack: Array<'content' | 'mask'> = [];
  private _finished = false;
  private readonly _meshSupported: boolean;

  constructor(options: { meshSupported: boolean }) {
    this._meshSupported = options.meshSupported;
  }

  reset(clearColor: Color): void {
    this._clearColor.r = clearColor.r;
    this._clearColor.g = clearColor.g;
    this._clearColor.b = clearColor.b;
    this._clearColor.a = clearColor.a;
    this._commands.length = 0;
    this._spriteBufferIndex = 0;
    this._currentSpriteBatch = null;
    this._filterStack.length = 0;
    this._maskStack.length = 0;
    this._finished = false;
  }

  finish(): RenderFrame {
    this.assertRecording();
    this.flushSpriteBatch();
    if (this._maskStack.length > 0) {
      throw new Error('Cannot finish frame with an active mask');
    }
    if (this._filterStack.length > 0) {
      throw new Error('Cannot finish frame with active filters');
    }
    this._finished = true;
    return { clearColor: this._clearColor, commands: this._commands };
  }

  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null): void {
    this.assertRecording();
    const width = frame?.width ?? image.width;
    const height = frame?.height ?? image.height;
    if (width <= 0 || height <= 0 || image.width <= 0 || image.height <= 0) {
      return;
    }

    let batch = this._currentSpriteBatch;
    if (
      !batch ||
      batch.command.image !== image ||
      batch.command.blendMode !== state.blendMode ||
      batch.command.smooth !== state.smooth
    ) {
      this.flushSpriteBatch();
      batch = this.createSpriteBatch(image, state);
      this._currentSpriteBatch = batch;
    }

    const offset = batch.length;
    this.ensureSpriteCapacity(batch, offset + SPRITE_INSTANCE_STRIDE);
    const data = batch.buffer;
    const transform = state.transform;
    data[offset] = transform.a;
    data[offset + 1] = transform.b;
    data[offset + 2] = transform.c;
    data[offset + 3] = transform.d;
    data[offset + 4] = transform.tx;
    data[offset + 5] = transform.ty;
    data[offset + 6] = width;
    data[offset + 7] = height;
    data[offset + 8] = (frame?.x ?? 0) / image.width;
    data[offset + 9] = (frame?.y ?? 0) / image.height;
    data[offset + 10] = ((frame?.x ?? 0) + width) / image.width;
    data[offset + 11] = ((frame?.y ?? 0) + height) / image.height;
    data[offset + 12] = clamp01(state.alpha);
    data[offset + 13] = clamp01(state.colorTone.r / 255);
    data[offset + 14] = clamp01(state.colorTone.g / 255);
    data[offset + 15] = clamp01(state.colorTone.b / 255);
    data[offset + 16] = clamp01(state.colorTone.a);
    batch.length += SPRITE_INSTANCE_STRIDE;
  }

  drawTexturedTriangles(params: DrawTexturedTrianglesParams): void {
    this.assertRecording();
    if (!this._meshSupported) {
      throw new Error('Textured triangle meshes are not supported on this platform');
    }
    this.flushSpriteBatch();
    const indices = Array.from(params.indices);
    this._commands.push({
      type: 'drawTexturedTriangles',
      image: params.image,
      state: snapshotState(params.state),
      positions: Float32Array.from(params.positions),
      uvs: Float32Array.from(params.uvs),
      indices: maxValue(indices) <= 0xffff ? Uint16Array.from(indices) : Uint32Array.from(indices),
      tint: params.tint ? { ...params.tint } : undefined,
    });
  }

  pushFilters(filters: readonly FilterInstance[], state: RenderState): void {
    this.assertRecording();
    const activeFilters = filters.filter((filter) => filter.enabled && !filter.disposed);
    const active = activeFilters.length > 0;
    this._filterStack.push(active);
    if (!active) {
      return;
    }
    this.flushSpriteBatch();
    this._commands.push({
      type: 'pushFilters',
      filters: activeFilters.map((filter) => ({
        resource: filter.resource,
        uniformData: filter.snapshotUniformData(),
      })),
      state: snapshotState(state),
    });
  }

  popFilters(): void {
    this.assertRecording();
    const active = this._filterStack.pop();
    if (active === undefined) {
      throw new Error('popFilters() called without matching pushFilters()');
    }
    if (!active) {
      return;
    }
    this.flushSpriteBatch();
    this._commands.push({ type: 'popFilters' });
  }

  pushMask(): void {
    this.assertRecording();
    this.flushSpriteBatch();
    this._maskStack.push('content');
    this._commands.push({ type: 'pushMask' });
  }

  activateMask(): void {
    this.assertRecording();
    const index = this._maskStack.length - 1;
    if (index < 0 || this._maskStack[index] !== 'content') {
      throw new Error('activateMask() called without an active mask content layer');
    }
    this.flushSpriteBatch();
    this._maskStack[index] = 'mask';
    this._commands.push({ type: 'activateMask' });
  }

  popMask(): void {
    this.assertRecording();
    if (this._maskStack.pop() !== 'mask') {
      throw new Error('popMask() called before activateMask()');
    }
    this.flushSpriteBatch();
    this._commands.push({ type: 'popMask' });
  }

  private createSpriteBatch(image: RenderableImage, state: RenderState): SpriteBatchBuilder {
    const bufferIndex = this._spriteBufferIndex;
    this._spriteBufferIndex += 1;
    const buffer = this._spriteBuffers[bufferIndex] ?? new Float32Array(SPRITE_INSTANCE_STRIDE * 16);
    this._spriteBuffers[bufferIndex] = buffer;
    return {
      buffer,
      length: 0,
      command: {
        type: 'spriteBatch',
        image,
        blendMode: state.blendMode,
        smooth: state.smooth,
        instanceCount: 0,
        instanceData: buffer.subarray(0, 0),
      },
    };
  }

  private ensureSpriteCapacity(batch: SpriteBatchBuilder, requiredLength: number): void {
    if (batch.buffer.length >= requiredLength) {
      return;
    }
    let capacity = batch.buffer.length;
    while (capacity < requiredLength) {
      capacity *= 2;
    }
    const grown = new Float32Array(capacity);
    grown.set(batch.buffer.subarray(0, batch.length));
    batch.buffer = grown;
    this._spriteBuffers[this._spriteBufferIndex - 1] = grown;
  }

  private flushSpriteBatch(): void {
    const batch = this._currentSpriteBatch;
    if (!batch || batch.length === 0) {
      this._currentSpriteBatch = null;
      return;
    }
    const instanceCount = batch.length / SPRITE_INSTANCE_STRIDE;
    this._commands.push({
      ...batch.command,
      instanceCount,
      instanceData: batch.buffer.subarray(0, batch.length),
    });
    this._currentSpriteBatch = null;
  }

  private assertRecording(): void {
    if (this._finished) {
      throw new Error('RenderCommandEncoder has already finished this frame');
    }
  }
}

function snapshotState(state: RenderState): RenderState {
  return {
    transform: { ...state.transform },
    alpha: state.alpha,
    blendMode: state.blendMode,
    colorTone: { ...state.colorTone },
    smooth: state.smooth,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function maxValue(values: readonly number[]): number {
  let result = 0;
  for (const value of values) {
    result = Math.max(result, value);
  }
  return result;
}
