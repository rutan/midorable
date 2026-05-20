import {
  BlendMode,
  Color,
  FilterInstance,
  Rectangle,
  RenderableImage,
  Renderer,
  RenderState,
  ShaderFilterDefinition,
} from '@rutan/midorable';
import { clamp01 } from '../internal/utilities';
import { WebGpuFilterInstance } from './WebGpuFilterInstance';
import { WebGpuPlatform } from './WebGpuPlatform';
import { WebGpuTexture } from './WebGpuTexture';
import { GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE } from './WebGpuUsage';

const FULLSCREEN_QUAD_VERTICES = new Float32Array([
  0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1,
]);

const DEFAULT_TEXTURE_FORMAT: GPUTextureFormat = 'bgra8unorm';
const FULLSCREEN_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 16,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x2' },
    { shaderLocation: 1, offset: 8, format: 'float32x2' },
  ],
};
const ALPHA_BLEND_STATE: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};
const MSAA_SAMPLE_COUNT = 4;

type RenderTarget = {
  view: GPUTextureView;
  texture: GPUTexture | null;
  attachmentView: GPUTextureView;
  attachmentTexture: GPUTexture | null;
};
type FrameContext = { device: GPUDevice; canvas: HTMLCanvasElement; target: RenderTarget };

export class WebGpuRenderer implements Renderer {
  static readonly FILTER_UNIFORM_VEC4_COUNT = 16;
  private _platform: WebGpuPlatform;
  private _pipelines: Partial<Record<BlendMode, GPURenderPipeline>> = {};
  private _shader: GPUShaderModule | null = null;
  private _linearSampler: GPUSampler | null = null;
  private _nearestSampler: GPUSampler | null = null;
  private _vertexBuffer: GPUBuffer | null = null;
  private _compositePipeline: GPURenderPipeline | null = null;
  private _compositeLinearSampler: GPUSampler | null = null;
  private _compositeNearestSampler: GPUSampler | null = null;
  private _encoder: GPUCommandEncoder | null = null;
  private _pass: GPURenderPassEncoder | null = null;
  private _textureView: GPUTextureView | null = null;
  private _frameMsaaTexture: GPUTexture | null = null;
  private _targetStack: RenderTarget[] = [];
  private _externalTextureCache = new WeakMap<HTMLImageElement | HTMLCanvasElement, GPUTexture>();
  private _externalTextures = new Set<GPUTexture>();
  private _textureViews = new WeakMap<GPUTexture, GPUTextureView>();
  private _textureIds = new WeakMap<GPUTexture, number>();
  private _nextTextureId = 1;
  private _spriteBindGroupCache = new Map<string, GPUBindGroup>();
  private _uniformBuffers: GPUBuffer[] = [];
  private _uniformCursor = 0;
  private _instanceBuffers: { size: number; buffer: GPUBuffer }[] = [];
  private _instanceCursor = 0;
  private _spriteBatch: {
    targetView: GPUTextureView;
    blendMode: BlendMode;
    texture: GPUTexture;
    smooth: boolean;
    instances: number[];
  } | null = null;
  private _maskStack: {
    parentTarget: RenderTarget;
    contentTarget: RenderTarget;
    maskTarget: RenderTarget;
  }[] = [];
  private _filterPipelines = new Map<string, GPURenderPipeline>();
  private _filterSampler: GPUSampler | null = null;
  private _filterStack: {
    target: RenderTarget;
    filters: WebGpuFilterInstance[];
  }[] = [];
  private _pendingTextureDestroy = new Set<GPUTexture>();
  private _clearColor: GPUColor = { r: 0, g: 0, b: 0, a: 1 };
  private static readonly SPRITE_INSTANCE_FLOATS = 19;

  constructor(platform: WebGpuPlatform) {
    this._platform = platform;
  }

  beginFrame() {
    const device = this._platform.device;
    const context = this._platform.context;
    if (!device || !context) {
      return;
    }

    this._encoder = device.createCommandEncoder();
    this._textureView = context.getCurrentTexture().createView();
    this._frameMsaaTexture = this.createMsaaRenderTexture(
      device,
      this._platform.canvas.width,
      this._platform.canvas.height,
    );
    this._pass = null;
    this._targetStack = [
      {
        view: this._textureView,
        texture: null,
        attachmentView: this._frameMsaaTexture.createView(),
        attachmentTexture: this._frameMsaaTexture,
      },
    ];
    this._maskStack = [];
    this._filterStack = [];
    this._uniformCursor = 0;
    this._instanceCursor = 0;
    this._spriteBatch = null;
  }

  endFrame() {
    if (!this._encoder || !this._platform.device) {
      return;
    }

    this.flushSpriteBatch(this._platform.device);
    if (this._pass) {
      this._pass.end();
    }

    this._platform.device.queue.submit([this._encoder.finish()]);
    this.flushPendingTextureDestroy();
    if (this._frameMsaaTexture) {
      this._frameMsaaTexture.destroy();
      this._frameMsaaTexture = null;
    }
    this._encoder = null;
    this._textureView = null;
    this._pass = null;
    this._targetStack = [];
    this._maskStack = [];
    this._filterStack = [];
    this._spriteBatch = null;
  }

  clear(color: Color = { r: 0, g: 0, b: 0, a: 1 }) {
    this._clearColor = colorToGpuColor(color);
    const target = this._targetStack[this._targetStack.length - 1] ?? null;
    if (!this._encoder || !target || this._pass) {
      return;
    }

    this._pass = this.beginColorPass(target, 'clear', this._clearColor);
  }

  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null) {
    const context = this.getActiveFrameContext();
    if (!context) {
      return;
    }
    const { device, canvas, target } = context;

    this.ensurePipeline(device, state.blendMode);
    if (!this._linearSampler || !this._nearestSampler || !this._vertexBuffer) {
      return;
    }

    if (!this._pass) {
      this._pass = this.beginColorPass(target, 'load', this._clearColor);
    }

    const source = this.resolveGpuTexture(image);
    if (!source) {
      return;
    }

    const currentBatch = this._spriteBatch;
    if (
      !currentBatch ||
      currentBatch.targetView !== target.attachmentView ||
      currentBatch.blendMode !== state.blendMode ||
      currentBatch.texture !== source ||
      currentBatch.smooth !== state.smooth
    ) {
      this.flushSpriteBatch(device);
      this._spriteBatch = {
        targetView: target.attachmentView,
        blendMode: state.blendMode,
        texture: source,
        smooth: state.smooth,
        instances: [],
      };
    }

    const drawWidth = frame ? frame.width : image.width;
    const drawHeight = frame ? frame.height : image.height;
    const uvRect = frame
      ? [
          frame.x / image.width,
          frame.y / image.height,
          (frame.x + frame.width) / image.width,
          (frame.y + frame.height) / image.height,
        ]
      : [0, 0, 1, 1];

    this._spriteBatch!.instances.push(
      state.transform.a,
      state.transform.b,
      state.transform.c,
      state.transform.d,
      state.transform.tx,
      state.transform.ty,
      drawWidth,
      drawHeight,
      uvRect[0],
      uvRect[1],
      uvRect[2],
      uvRect[3],
      canvas.width,
      canvas.height,
      state.alpha,
      clamp01(state.colorTone.r / 255),
      clamp01(state.colorTone.g / 255),
      clamp01(state.colorTone.b / 255),
      clamp01(state.colorTone.a),
    );
  }

  async createFilter(definition: ShaderFilterDefinition): Promise<FilterInstance> {
    const device = this._platform.device;
    if (!device) {
      throw new Error('WebGPU renderer is not initialized');
    }
    if (definition.language !== 'wgsl') {
      throw new Error(`Unsupported shader language: ${definition.language}`);
    }
    const pipeline = await this.ensureFilterPipeline(device, definition.fragment);
    return new WebGpuFilterInstance(definition, pipeline);
  }

  pushFilters(filters: readonly FilterInstance[], _state: RenderState): boolean {
    const frame = this.getActiveFrameContext();
    if (!frame) {
      return false;
    }
    const { device, canvas } = frame;

    const enabledFilters = filters.filter(
      (filter): filter is WebGpuFilterInstance =>
        filter instanceof WebGpuFilterInstance && filter.enabled && !filter.isDisposed,
    );
    if (enabledFilters.length === 0) {
      return false;
    }

    this.flushAndEndPass(device);

    const target = this.createRenderTarget(device, canvas.width, canvas.height);
    this._targetStack.push(target);
    this._filterStack.push({ target, filters: enabledFilters });

    this._pass = this.beginColorPass(target, 'clear', { r: 0, g: 0, b: 0, a: 0 });
    return true;
  }

  popFilters() {
    const frame = this.getActiveFrameContext();
    if (!frame) {
      return;
    }
    const { device, canvas } = frame;

    this.flushAndEndPass(device);

    const entry = this._filterStack.pop();
    const target = this._targetStack.pop();
    const parentTarget = this._targetStack[this._targetStack.length - 1] ?? null;
    if (!entry || !target || !parentTarget) {
      return;
    }
    const sourceTexture = entry.target.texture;
    if (!sourceTexture) {
      this.scheduleRenderTargetDestroy(entry.target);
      return;
    }

    let inputTexture: GPUTexture = sourceTexture;
    const filters = entry.filters;
    for (let index = 0; index < filters.length; index += 1) {
      const filter = filters[index];
      const isLast = index === filters.length - 1;
      const outputTarget = isLast ? parentTarget : this.createRenderTarget(device, canvas.width, canvas.height);

      this.drawFilterPass(device, inputTexture, outputTarget, filter, !isLast);
      if (!isLast) {
        this.scheduleTextureDestroy(outputTarget.attachmentTexture!);
      }

      if (inputTexture !== sourceTexture) {
        this.scheduleTextureDestroy(inputTexture);
      }
      if (!isLast && outputTarget.texture) {
        inputTexture = outputTarget.texture;
      }
    }

    this.scheduleTextureDestroy(entry.target.attachmentTexture!);
    this.scheduleTextureDestroy(sourceTexture);
  }

  pushMask() {
    const frame = this.getActiveFrameContext();
    if (!frame) {
      return;
    }
    const { device, canvas } = frame;

    this.flushAndEndPass(device);

    const parentTarget = this._targetStack[this._targetStack.length - 1] ?? null;
    if (!parentTarget) {
      return;
    }
    const contentTarget = this.createRenderTarget(device, canvas.width, canvas.height);
    const maskTarget = this.createRenderTarget(device, canvas.width, canvas.height);
    this._targetStack.push(contentTarget);
    this._maskStack.push({ parentTarget, contentTarget, maskTarget });

    this._pass = this.beginColorPass(contentTarget, 'clear', { r: 0, g: 0, b: 0, a: 0 });
  }

  activateMask() {
    const frame = this.getActiveFrameContext();
    if (!frame) {
      return;
    }
    const { device } = frame;
    const entry = this._maskStack[this._maskStack.length - 1];
    if (!entry) {
      return;
    }

    this.flushAndEndPass(device);
    this._targetStack.pop();
    this._targetStack.push(entry.maskTarget);
    this._pass = this.beginColorPass(entry.maskTarget, 'clear', { r: 0, g: 0, b: 0, a: 0 });
  }

  popMask() {
    const frame = this.getActiveFrameContext();
    if (!frame) {
      return;
    }
    const { device, canvas } = frame;

    this.flushAndEndPass(device);

    const entry = this._maskStack.pop();
    if (!entry) {
      return;
    }

    const target = this._targetStack.pop();
    if (!target || target !== entry.maskTarget) {
      return;
    }

    const source = entry.contentTarget.texture;
    const maskSource = entry.maskTarget.texture;
    if (!source || !maskSource) {
      this.scheduleRenderTargetDestroy(entry.contentTarget);
      this.scheduleRenderTargetDestroy(entry.maskTarget);
      return;
    }

    this.ensureCompositePipeline(device);
    if (
      !this._compositePipeline ||
      !this._compositeLinearSampler ||
      !this._compositeNearestSampler ||
      !this._vertexBuffer
    ) {
      return;
    }

    // Content and mask are already rendered into full-size offscreen targets,
    // so the composite pass only needs to map fullscreen UVs 1:1.
    const uniformData = new Float32Array([
      1,
      0,
      0,
      1,
      0,
      0,
      canvas.width,
      canvas.height,
      canvas.width,
      canvas.height,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

    const { buffer: uniformBuffer } = this.writeUniform(device, uniformData);
    const bindGroup = this.getCompositeBindGroup(device, source, maskSource, uniformBuffer, true);

    const pass = this.beginColorPass(entry.parentTarget, 'load', this._clearColor);
    pass.setPipeline(this._compositePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(6, 1, 0, 0);
    pass.end();
    this.scheduleTextureDestroy(entry.contentTarget.attachmentTexture!);
    this.scheduleTextureDestroy(entry.maskTarget.attachmentTexture!);
    this.scheduleTextureDestroy(source);
    this.scheduleTextureDestroy(maskSource);
  }

  resize(_width: number, _height: number) {}

  dispose() {
    for (const entry of this._instanceBuffers) {
      entry.buffer.destroy();
    }
    this._instanceBuffers = [];
    if (this._vertexBuffer) {
      this._vertexBuffer.destroy();
      this._vertexBuffer = null;
    }
    for (const buffer of this._uniformBuffers) {
      buffer.destroy();
    }
    this._uniformBuffers = [];
    this._pipelines = {};
    this._shader = null;
    this._linearSampler = null;
    this._nearestSampler = null;
    this._compositePipeline = null;
    this._compositeLinearSampler = null;
    this._compositeNearestSampler = null;
    this._filterSampler = null;
    for (const texture of this._externalTextures) {
      texture.destroy();
    }
    this._externalTextures.clear();
    this._externalTextureCache = new WeakMap();
    this._textureViews = new WeakMap();
    this._textureIds = new WeakMap();
    this._spriteBindGroupCache.clear();
    this._filterPipelines.clear();
    this._filterStack = [];
    this.flushPendingTextureDestroy();
    if (this._frameMsaaTexture) {
      this._frameMsaaTexture.destroy();
      this._frameMsaaTexture = null;
    }
    this._spriteBatch = null;
  }

  releaseExternalTexture(source: unknown) {
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return;
    }

    const texture = this._externalTextureCache.get(source);
    if (!texture) {
      return;
    }

    texture.destroy();
    this._externalTextureCache.delete(source);
    this._externalTextures.delete(texture);
    this._textureViews = new WeakMap();
    this._textureIds = new WeakMap();
    this._spriteBindGroupCache.clear();
    if (this._spriteBatch && this._spriteBatch.texture === texture) {
      this._spriteBatch = null;
    }
  }

  private getTextureFormat(): GPUTextureFormat {
    return this._platform.format ?? DEFAULT_TEXTURE_FORMAT;
  }

  private getActiveFrameContext(): FrameContext | null {
    const device = this._platform.device;
    const canvas = this._platform.canvas;
    if (!device || !canvas || !this._encoder) {
      return null;
    }

    const target = this._targetStack[this._targetStack.length - 1] ?? null;
    if (!target) {
      return null;
    }
    return { device, canvas, target };
  }

  private createFullscreenPipeline(
    device: GPUDevice,
    module: GPUShaderModule,
    blend: GPUBlendState,
  ): GPURenderPipeline {
    return device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vsMain',
        buffers: [FULLSCREEN_VERTEX_BUFFER_LAYOUT],
      },
      fragment: {
        module,
        entryPoint: 'fsMain',
        targets: [{ format: this.getTextureFormat(), blend }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });
  }

  private ensurePipeline(device: GPUDevice, blendMode: BlendMode): GPURenderPipeline {
    const cached = this._pipelines[blendMode];
    if (cached && this._linearSampler && this._nearestSampler && this._vertexBuffer) {
      return cached;
    }

    if (!this._shader) {
      this._shader = device.createShaderModule({
        code: `
          @group(0) @binding(0) var texSampler: sampler;
          @group(0) @binding(1) var tex: texture_2d<f32>;

          struct VertexInput {
            @location(0) position: vec2<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) transformAB: vec2<f32>,
            @location(3) transformCD: vec2<f32>,
            @location(4) translateSize: vec4<f32>,
            @location(5) uvRect: vec4<f32>,
            @location(6) viewport: vec2<f32>,
            @location(7) alpha: f32,
            @location(8) tone: vec4<f32>,
          }

          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
            @location(1) alpha: f32,
            @location(2) tone: vec4<f32>,
          }

          @vertex
          fn vsMain(input: VertexInput) -> VertexOutput {
            let local = input.position * input.translateSize.zw;
            let world = vec2<f32>(
              input.transformAB.x * local.x + input.transformCD.x * local.y + input.translateSize.x,
              input.transformAB.y * local.x + input.transformCD.y * local.y + input.translateSize.y
            );
            let clip = vec2<f32>(
              (world.x / input.viewport.x) * 2.0 - 1.0,
              1.0 - (world.y / input.viewport.y) * 2.0
            );
            var output: VertexOutput;
            output.position = vec4<f32>(clip, 0.0, 1.0);
            output.uv = input.uvRect.xy + input.uv * (input.uvRect.zw - input.uvRect.xy);
            output.alpha = input.alpha;
            output.tone = input.tone;
            return output;
          }

          @fragment
          fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
            let color = textureSample(tex, texSampler, input.uv);
            let toned = mix(color.rgb, input.tone.rgb, input.tone.a);
            return vec4<f32>(toned, color.a * input.alpha);
          }
        `,
      });
    }

    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this._shader,
        entryPoint: 'vsMain',
        buffers: [
          FULLSCREEN_VERTEX_BUFFER_LAYOUT,
          {
            arrayStride: 76,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x2' },
              { shaderLocation: 3, offset: 8, format: 'float32x2' },
              { shaderLocation: 4, offset: 16, format: 'float32x4' },
              { shaderLocation: 5, offset: 32, format: 'float32x4' },
              { shaderLocation: 6, offset: 48, format: 'float32x2' },
              { shaderLocation: 7, offset: 56, format: 'float32' },
              { shaderLocation: 8, offset: 60, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: {
        module: this._shader,
        entryPoint: 'fsMain',
        targets: [
          {
            format: this.getTextureFormat(),
            blend: this.getBlendState(blendMode),
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: MSAA_SAMPLE_COUNT,
      },
    });

    this._pipelines[blendMode] = pipeline;
    if (!this._linearSampler) {
      this._linearSampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });
    }
    if (!this._nearestSampler) {
      this._nearestSampler = device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
      });
    }
    this.ensureFullscreenQuadBuffer(device);

    return pipeline;
  }

  private getBlendState(blendMode: BlendMode): GPUBlendState | undefined {
    switch (blendMode) {
      case 'add':
        return {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
        };
      case 'subtract':
        return {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'reverse-subtract' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'reverse-subtract' },
        };
      case 'multiply':
        return {
          color: { srcFactor: 'dst', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        };
      case 'screen':
        return {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        };
      default:
        return {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        };
    }
  }

  private ensureCompositePipeline(device: GPUDevice) {
    if (
      this._compositePipeline &&
      this._compositeLinearSampler &&
      this._compositeNearestSampler &&
      this._vertexBuffer
    ) {
      return;
    }

    const shader = device.createShaderModule({
      code: `
        struct Globals {
          invTransform: vec4<f32>,
          invTranslateMask: vec4<f32>,
          viewport: vec4<f32>,
        }

        @group(0) @binding(0) var texSampler: sampler;
        @group(0) @binding(1) var colorTex: texture_2d<f32>;
        @group(0) @binding(2) var maskTex: texture_2d<f32>;
        @group(0) @binding(3) var<uniform> globals: Globals;

        struct VertexInput {
          @location(0) position: vec2<f32>,
          @location(1) uv: vec2<f32>,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vsMain(input: VertexInput) -> VertexOutput {
          let clip = vec2<f32>(input.position.x * 2.0 - 1.0, 1.0 - input.position.y * 2.0);
          var output: VertexOutput;
          output.position = vec4<f32>(clip, 0.0, 1.0);
          output.uv = input.uv;
          return output;
        }

        @fragment
        fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
          let world = input.uv * globals.viewport.xy;
          let local = vec2<f32>(
            globals.invTransform.x * world.x + globals.invTransform.z * world.y + globals.invTranslateMask.x,
            globals.invTransform.y * world.x + globals.invTransform.w * world.y + globals.invTranslateMask.y
          );
          let maskUv = local / globals.invTranslateMask.zw;
          // Anti-alias mask bounds in shader space to reduce jaggies on rotated/scaled masks.
          let aa = max(fwidth(maskUv), vec2<f32>(0.0001));
          let inLower = smoothstep(vec2<f32>(0.0), aa, maskUv);
          let inUpper = vec2<f32>(1.0) - smoothstep(vec2<f32>(1.0) - aa, vec2<f32>(1.0), maskUv);
          let inBounds = inLower * inUpper;
          let maskColor = textureSample(maskTex, texSampler, maskUv);
          let maskAlpha = maskColor.a * inBounds.x * inBounds.y;
          let color = textureSample(colorTex, texSampler, input.uv);
          return vec4<f32>(color.rgb, color.a * maskAlpha);
        }
      `,
    });

    this._compositePipeline = this.createFullscreenPipeline(device, shader, ALPHA_BLEND_STATE);

    this._compositeLinearSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    this._compositeNearestSampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.ensureFullscreenQuadBuffer(device);
  }

  private async ensureFilterPipeline(device: GPUDevice, fragmentShader: string): Promise<GPURenderPipeline> {
    const cached = this._filterPipelines.get(fragmentShader);
    if (cached) {
      return cached;
    }

    const shaderModule = device.createShaderModule({
      code: createFilterShaderSource(fragmentShader),
    });
    const compilation = await shaderModule.getCompilationInfo();
    const errors = compilation.messages.filter((message) => message.type === 'error');
    if (errors.length > 0) {
      const details = errors.map((error) => error.message).join('\n');
      throw new Error(`Failed to compile WGSL filter:\n${details}`);
    }

    const pipeline = this.createFullscreenPipeline(device, shaderModule, ALPHA_BLEND_STATE);
    this._filterPipelines.set(fragmentShader, pipeline);

    if (!this._filterSampler) {
      this._filterSampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }
    this.ensureFullscreenQuadBuffer(device);

    return pipeline;
  }

  private drawFilterPass(
    device: GPUDevice,
    inputTexture: GPUTexture,
    outputTarget: RenderTarget,
    filter: WebGpuFilterInstance,
    clearOutput: boolean,
  ) {
    if (!this._encoder || !this._vertexBuffer || !this._filterSampler) {
      return;
    }

    const { buffer: uniformBuffer } = this.writeUniform(device, filter.uniformBufferData);
    const bindGroup = device.createBindGroup({
      layout: filter.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this._filterSampler },
        { binding: 1, resource: this.getTextureView(inputTexture) },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    });

    const pass = this.beginColorPass(outputTarget, clearOutput ? 'clear' : 'load', { r: 0, g: 0, b: 0, a: 0 });
    pass.setPipeline(filter.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(6, 1, 0, 0);
    pass.end();
  }

  private resolveGpuTexture(image: RenderableImage): GPUTexture | null {
    if (image instanceof WebGpuTexture) {
      image.ensureUploaded();
      return image.source;
    }

    const source = image.source;
    if (source instanceof GPUTexture) {
      return source;
    }

    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return null;
    }

    const device = this._platform.device;
    if (!device || image.width <= 0 || image.height <= 0) {
      return null;
    }

    const cached = this._externalTextureCache.get(source);
    if (cached) {
      if (source instanceof HTMLCanvasElement) {
        this.uploadExternalImage(source, cached, image.width, image.height);
      }
      return cached;
    }

    const texture = device.createTexture({
      size: [image.width, image.height, 1],
      format: 'rgba8unorm',
      usage: GPU_TEXTURE_USAGE.textureBinding | GPU_TEXTURE_USAGE.copyDst | GPU_TEXTURE_USAGE.renderAttachment,
    });

    this.uploadExternalImage(source, texture, image.width, image.height);
    this._externalTextureCache.set(source, texture);
    this._externalTextures.add(texture);
    return texture;
  }

  private uploadExternalImage(
    source: HTMLImageElement | HTMLCanvasElement,
    texture: GPUTexture,
    width: number,
    height: number,
  ) {
    const device = this._platform.device;
    if (!device) {
      return;
    }

    try {
      device.queue.copyExternalImageToTexture({ source }, { texture }, [width, height]);
    } catch (error) {
      console.error('Failed to upload external image to GPU texture:', error);
      throw error;
    }
  }

  private writeUniform(device: GPUDevice, uniformData: Float32Array) {
    const slot = this._uniformCursor;
    this._uniformCursor += 1;
    const buffer = this.ensureUniformBuffer(device, slot);
    device.queue.writeBuffer(buffer, 0, uniformData.buffer, uniformData.byteOffset, uniformData.byteLength);
    return { buffer, slot };
  }

  private ensureUniformBuffer(device: GPUDevice, slot: number) {
    const cached = this._uniformBuffers[slot];
    if (cached) {
      return cached;
    }
    const buffer = device.createBuffer({
      // Uniform binding size must be aligned to 256 bytes in WebGPU.
      size: 256,
      usage: GPU_BUFFER_USAGE.uniform | GPU_BUFFER_USAGE.copyDst,
    });
    this._uniformBuffers[slot] = buffer;
    return buffer;
  }

  private getSpriteBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    source: GPUTexture,
    blendMode: BlendMode,
    smooth: boolean,
  ) {
    const textureId = this.getTextureId(source);
    const cacheKey = `s:${blendMode}:${smooth ? '1' : '0'}:${textureId}`;
    const cached = this._spriteBindGroupCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sampler = smooth ? this._linearSampler! : this._nearestSampler!;
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: this.getTextureView(source) },
      ],
    });
    this._spriteBindGroupCache.set(cacheKey, bindGroup);
    return bindGroup;
  }

  private flushSpriteBatch(device: GPUDevice) {
    if (!this._spriteBatch || !this._pass || !this._vertexBuffer) {
      return;
    }
    const { blendMode, texture, smooth, instances } = this._spriteBatch;
    if (instances.length === 0) {
      this._spriteBatch = null;
      return;
    }

    const pipeline = this.ensurePipeline(device, blendMode);
    const instanceData = new Float32Array(instances);
    const instanceCount = Math.floor(instanceData.length / WebGpuRenderer.SPRITE_INSTANCE_FLOATS);
    if (instanceCount <= 0) {
      this._spriteBatch = null;
      return;
    }
    const bindGroup = this.getSpriteBindGroup(device, pipeline, texture, blendMode, smooth);
    const slot = this._instanceCursor;
    this._instanceCursor += 1;
    const instanceBuffer = this.ensureInstanceBuffer(device, slot, instanceData.byteLength);
    device.queue.writeBuffer(instanceBuffer, 0, instanceData.buffer, instanceData.byteOffset, instanceData.byteLength);

    this._pass.setPipeline(pipeline);
    this._pass.setBindGroup(0, bindGroup);
    this._pass.setVertexBuffer(0, this._vertexBuffer);
    this._pass.setVertexBuffer(1, instanceBuffer);
    this._pass.draw(6, instanceCount, 0, 0);
    this._spriteBatch = null;
  }

  private ensureInstanceBuffer(device: GPUDevice, slot: number, requiredBytes: number) {
    const entry = this._instanceBuffers[slot];
    if (entry && entry.size >= requiredBytes) {
      return entry.buffer;
    }
    entry?.buffer.destroy();

    const size = Math.max(256, roundUpTo(requiredBytes, 256));
    const buffer = device.createBuffer({
      size,
      usage: GPU_BUFFER_USAGE.vertex | GPU_BUFFER_USAGE.copyDst,
    });
    this._instanceBuffers[slot] = { size, buffer };
    return buffer;
  }

  private beginColorPass(target: RenderTarget, loadOp: GPULoadOp, clearValue: GPUColor): GPURenderPassEncoder {
    if (!this._encoder) {
      throw new Error('WebGPU command encoder is not initialized');
    }
    return this._encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target.attachmentView,
          resolveTarget: target.attachmentTexture ? target.view : undefined,
          clearValue,
          loadOp,
          storeOp: 'store',
        },
      ],
    });
  }

  private flushAndEndPass(device: GPUDevice) {
    this.flushSpriteBatch(device);
    if (!this._pass) {
      return;
    }
    this._pass.end();
    this._pass = null;
  }

  private createRenderTexture(device: GPUDevice, width: number, height: number): GPUTexture {
    return device.createTexture({
      size: [width, height, 1],
      format: this.getTextureFormat(),
      usage: GPU_TEXTURE_USAGE.renderAttachment | GPU_TEXTURE_USAGE.textureBinding,
    });
  }

  private createMsaaRenderTexture(device: GPUDevice, width: number, height: number): GPUTexture {
    return device.createTexture({
      size: [width, height, 1],
      sampleCount: MSAA_SAMPLE_COUNT,
      format: this.getTextureFormat(),
      usage: GPU_TEXTURE_USAGE.renderAttachment,
    });
  }

  private createRenderTarget(device: GPUDevice, width: number, height: number): RenderTarget {
    const texture = this.createRenderTexture(device, width, height);
    const attachmentTexture = this.createMsaaRenderTexture(device, width, height);
    return {
      view: texture.createView(),
      texture,
      attachmentView: attachmentTexture.createView(),
      attachmentTexture,
    };
  }

  private ensureFullscreenQuadBuffer(device: GPUDevice): GPUBuffer {
    if (this._vertexBuffer) {
      return this._vertexBuffer;
    }
    const buffer = device.createBuffer({
      size: FULLSCREEN_QUAD_VERTICES.byteLength,
      usage: GPU_BUFFER_USAGE.vertex | GPU_BUFFER_USAGE.copyDst,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(FULLSCREEN_QUAD_VERTICES);
    buffer.unmap();
    this._vertexBuffer = buffer;
    return buffer;
  }

  private getCompositeBindGroup(
    device: GPUDevice,
    colorSource: GPUTexture,
    maskSource: GPUTexture,
    uniformBuffer: GPUBuffer,
    smooth: boolean,
  ) {
    const sampler = smooth ? this._compositeLinearSampler! : this._compositeNearestSampler!;
    return device.createBindGroup({
      layout: this._compositePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: this.getTextureView(colorSource) },
        { binding: 2, resource: this.getTextureView(maskSource) },
        { binding: 3, resource: { buffer: uniformBuffer } },
      ],
    });
  }

  private getTextureView(texture: GPUTexture) {
    const cached = this._textureViews.get(texture);
    if (cached) {
      return cached;
    }
    const view = texture.createView();
    this._textureViews.set(texture, view);
    return view;
  }

  private getTextureId(texture: GPUTexture) {
    const cached = this._textureIds.get(texture);
    if (cached !== undefined) {
      return cached;
    }
    const id = this._nextTextureId;
    this._nextTextureId += 1;
    this._textureIds.set(texture, id);
    return id;
  }

  private scheduleTextureDestroy(texture: GPUTexture) {
    this._pendingTextureDestroy.add(texture);
  }

  private scheduleRenderTargetDestroy(target: RenderTarget) {
    if (target.attachmentTexture) {
      this.scheduleTextureDestroy(target.attachmentTexture);
    }
    if (target.texture) {
      this.scheduleTextureDestroy(target.texture);
    }
  }

  private flushPendingTextureDestroy() {
    for (const texture of this._pendingTextureDestroy) {
      texture.destroy();
    }
    this._pendingTextureDestroy.clear();
  }
}

function colorToGpuColor(color: Color): GPUColor {
  return {
    r: Math.min(255, Math.max(0, color.r)) / 255,
    g: Math.min(255, Math.max(0, color.g)) / 255,
    b: Math.min(255, Math.max(0, color.b)) / 255,
    a: Math.min(1, Math.max(0, color.a)),
  };
}

function roundUpTo(value: number, unit: number) {
  if (value <= 0) {
    return unit;
  }
  return Math.ceil(value / unit) * unit;
}

function createFilterShaderSource(fragmentShader: string) {
  return `
struct FilterUniforms {
  data: array<vec4<f32>, 16>,
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: FilterUniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let clip = vec2<f32>(input.position.x * 2.0 - 1.0, 1.0 - input.position.y * 2.0);
  var output: VertexOutput;
  output.position = vec4<f32>(clip, 0.0, 1.0);
  output.uv = input.uv;
  return output;
}

${fragmentShader}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let color = textureSample(tex, texSampler, input.uv);
  return applyFilter(color, input.uv, uniforms.data);
}
`.trim();
}
