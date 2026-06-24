import {
  Color,
  DrawTexturedTrianglesParams,
  FilterInstance,
  Rectangle,
  RenderableImage,
  Renderer,
  RendererMeshFeature,
  RenderState,
  ShaderFilterDefinition,
} from '@rutan/midorable';
import { CanvasBackedTexture } from '../internal/CanvasBackedTexture';
import { clamp01, clamp255 } from '../internal/utilities';
import { WebGlFilterInstance } from './WebGlFilterInstance';

type RenderTarget = {
  framebuffer: WebGLFramebuffer | null;
  resolveFramebuffer: WebGLFramebuffer | null;
  texture: WebGLTexture | null;
  msaaRenderbuffer: WebGLRenderbuffer | null;
  width: number;
  height: number;
};

type MaskStackEntry = {
  parentTarget: RenderTarget;
  contentTarget: RenderTarget;
  maskTarget: RenderTarget;
};

type FilterStackEntry = {
  filters: WebGlFilterInstance[];
};

type SourceTextureCacheEntry = {
  texture: WebGLTexture;
  uploadedImageWidth: number;
  uploadedImageHeight: number;
  uploadedCanvasRevision: number | null;
  smooth: boolean;
};

type SpriteBatch = {
  source: HTMLImageElement | HTMLCanvasElement;
  sourceRevision: number | null;
  target: RenderTarget;
  texture: WebGLTexture;
  blendMode: RenderState['blendMode'];
  smooth: boolean;
  vertices: number[];
};

export class WebGlRenderer implements Renderer, RendererMeshFeature {
  static readonly FILTER_UNIFORM_VEC4_COUNT = 16;

  private _canvas: HTMLCanvasElement;
  private _gl: WebGL2RenderingContext;
  private _spriteProgram!: WebGLProgram;
  private _spriteAPositionLocation!: number;
  private _spriteAUvLocation!: number;
  private _spriteAAlphaLocation!: number;
  private _spriteAToneLocation!: number;
  private _spriteUTextureLocation!: WebGLUniformLocation;
  private _meshProgram!: WebGLProgram;
  private _meshAPositionLocation!: number;
  private _meshAUvLocation!: number;
  private _meshUTextureLocation!: WebGLUniformLocation;
  private _meshUToneLocation!: WebGLUniformLocation;
  private _meshUTintLocation!: WebGLUniformLocation;
  private _maskProgram!: WebGLProgram;
  private _maskAPositionLocation!: number;
  private _maskAUvLocation!: number;
  private _maskUContentTextureLocation!: WebGLUniformLocation;
  private _maskUMaskTextureLocation!: WebGLUniformLocation;
  private _spriteVertexBuffer!: WebGLBuffer;
  private _positionBuffer!: WebGLBuffer;
  private _uvBuffer!: WebGLBuffer;
  private _meshIndexBuffer!: WebGLBuffer;
  private _fullscreenPositionBuffer!: WebGLBuffer;
  private _fullscreenUvBuffer!: WebGLBuffer;
  private _sourceTextureCache = new WeakMap<HTMLImageElement | HTMLCanvasElement, SourceTextureCacheEntry>();
  private _ownedTextures = new Set<WebGLTexture>();
  private _ownedFramebuffers = new Set<WebGLFramebuffer>();
  private _ownedRenderbuffers = new Set<WebGLRenderbuffer>();
  private _ownedPrograms = new Set<WebGLProgram>();
  private _filters = new Set<WebGlFilterInstance>();
  private _renderTargetPool = new Map<string, RenderTarget[]>();
  private _targetStack: RenderTarget[] = [];
  private _maskStack: MaskStackEntry[] = [];
  private _filterStack: FilterStackEntry[] = [];
  private _spriteBatch: SpriteBatch | null = null;
  private _frameActive = false;
  private _contextLost = false;
  private _offscreenSampleCount: number;

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this._canvas = canvas;
    this._gl = gl;
    const maxSamples = Number(gl.getParameter(gl.MAX_SAMPLES) ?? 1);
    this._offscreenSampleCount = Math.max(1, Math.min(4, maxSamples));
    this.initializeGlResources();
    this.resize(canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  }

  onContextLost() {
    this._contextLost = true;
    this._frameActive = false;
    this._targetStack = [];
    this._maskStack = [];
    this._filterStack = [];
    this._spriteBatch = null;
  }

  onContextRestored() {
    if (!this._contextLost) {
      return;
    }
    this._contextLost = false;
    this._frameActive = false;
    this._targetStack = [];
    this._maskStack = [];
    this._filterStack = [];
    this._spriteBatch = null;
    this._renderTargetPool.clear();
    this._sourceTextureCache = new WeakMap<HTMLImageElement | HTMLCanvasElement, SourceTextureCacheEntry>();
    this._ownedTextures.clear();
    this._ownedFramebuffers.clear();
    this._ownedRenderbuffers.clear();
    this._ownedPrograms.clear();

    this.initializeGlResources();
    this.rebindFiltersAfterContextRestore();
    this.resize(this._canvas.width, this._canvas.height);
    const maxSamples = Number(this._gl.getParameter(this._gl.MAX_SAMPLES) ?? 1);
    this._offscreenSampleCount = Math.max(1, Math.min(4, maxSamples));
    this._gl.disable(this._gl.DEPTH_TEST);
    this._gl.disable(this._gl.CULL_FACE);
    this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  }

  beginFrame() {
    if (this._contextLost) {
      this._frameActive = false;
      return;
    }
    const rootTarget: RenderTarget = {
      framebuffer: null,
      resolveFramebuffer: null,
      texture: null,
      msaaRenderbuffer: null,
      width: this._canvas.width,
      height: this._canvas.height,
    };
    this._frameActive = true;
    this._targetStack = [rootTarget];
    this._maskStack = [];
    this._filterStack = [];
    this.bindTarget(rootTarget);
    this._gl.enable(this._gl.BLEND);
  }

  endFrame() {
    this.flushSpriteBatch();
    this._frameActive = false;
    this._maskStack = [];
    this._filterStack = [];

    for (const target of this._targetStack) {
      this.recycleTarget(target);
    }
    this._targetStack = [];
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null);
  }

  clear(color: Color = { r: 0, g: 0, b: 0, a: 1 }) {
    if (!this._frameActive) {
      return;
    }

    this.flushSpriteBatch();
    const gl = this._gl;
    const currentTarget = this.currentTarget;
    if (!currentTarget) {
      return;
    }
    this.bindTarget(currentTarget);
    gl.clearColor(clamp255(color.r) / 255, clamp255(color.g) / 255, clamp255(color.b) / 255, clamp01(color.a));
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  drawSprite(image: RenderableImage, state: RenderState, frame?: Rectangle | null) {
    const currentTarget = this.currentTarget;
    if (!this._frameActive || !currentTarget) {
      return;
    }

    const source = image.source;
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return;
    }

    const sourceRevision = source instanceof HTMLCanvasElement ? getCanvasBackedTextureRevision(image) : null;
    const canBatchSource = source instanceof HTMLImageElement || sourceRevision !== null;
    if (!canBatchSource) {
      this.flushSpriteBatch();
    } else if (
      this._spriteBatch?.source === source &&
      (this._spriteBatch.smooth !== state.smooth || this._spriteBatch.sourceRevision !== sourceRevision)
    ) {
      this.flushSpriteBatch();
    }

    const texture = this.resolveTexture(source, state.smooth, sourceRevision);
    if (!texture) {
      return;
    }

    const width = frame?.width ?? image.width;
    const height = frame?.height ?? image.height;
    if (width <= 0 || height <= 0 || currentTarget.width <= 0 || currentTarget.height <= 0) {
      return;
    }

    const uv = buildUv(image, frame ?? null);
    const alpha = clamp01(state.alpha);
    const toneR = clamp255(state.colorTone.r) / 255;
    const toneG = clamp255(state.colorTone.g) / 255;
    const toneB = clamp255(state.colorTone.b) / 255;
    const toneA = clamp01(state.colorTone.a);

    if (!canBatchSource) {
      const vertices: number[] = [];
      appendSpriteVertices(vertices, currentTarget.width, currentTarget.height, state, width, height, uv, {
        alpha,
        toneR,
        toneG,
        toneB,
        toneA,
      });
      this.drawSpriteVerticesWithProgram({
        texture,
        target: currentTarget,
        vertices,
        blendMode: state.blendMode,
      });
      return;
    }

    this.queueSpriteBatch({
      source,
      sourceRevision,
      texture,
      target: currentTarget,
      state,
      drawWidth: width,
      drawHeight: height,
      uv,
      alpha,
      toneR,
      toneG,
      toneB,
      toneA,
    });
  }

  drawTexturedTriangles(params: DrawTexturedTrianglesParams): void {
    const currentTarget = this.currentTarget;
    if (!this._frameActive || !currentTarget) {
      return;
    }

    this.flushSpriteBatch();
    const source = params.image.source;
    if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) {
      return;
    }
    const texture = this.resolveTexture(source, params.state.smooth);
    if (!texture || currentTarget.width <= 0 || currentTarget.height <= 0) {
      return;
    }

    const vertexCount = Math.min(Math.floor(params.positions.length / 2), Math.floor(params.uvs.length / 2));
    const indexCount = params.indices.length - (params.indices.length % 3);
    if (vertexCount <= 0 || indexCount <= 0) {
      return;
    }

    const positions = buildMeshClipSpacePositions(
      currentTarget.width,
      currentTarget.height,
      params.state,
      params.positions,
      vertexCount,
    );
    const uvs = copyNumberArray(params.uvs, vertexCount * 2);
    const indices = buildMeshIndices(params.indices, indexCount, vertexCount);
    if (!indices) {
      return;
    }

    this.drawMeshWithProgram({
      target: currentTarget,
      texture,
      state: params.state,
      positions,
      uvs,
      indices,
      tint: params.tint,
    });
  }

  async createFilter(definition: ShaderFilterDefinition): Promise<FilterInstance> {
    if (definition.language !== 'glsl-es-300') {
      throw new Error(`Unsupported shader language: ${definition.language}`);
    }
    if (this._contextLost) {
      throw new Error('WebGL context is lost');
    }

    const compiled = this.compileFilterProgram(definition);

    const filter = new WebGlFilterInstance({
      definition,
      program: compiled.program,
      aPositionLocation: compiled.aPositionLocation,
      aUvLocation: compiled.aUvLocation,
      uTextureLocation: compiled.uTextureLocation,
      uUniformsLocation: compiled.uUniformsLocation,
      onDispose: (disposedProgram) => {
        this._gl.deleteProgram(disposedProgram);
        this._ownedPrograms.delete(disposedProgram);
        this._filters.delete(filter);
      },
    });
    this._filters.add(filter);

    return filter;
  }

  pushFilters(filters: readonly FilterInstance[], _state: RenderState): boolean {
    if (!this._frameActive) {
      return false;
    }

    this.flushSpriteBatch();
    const enabledFilters = filters.filter(
      (filter): filter is WebGlFilterInstance =>
        filter instanceof WebGlFilterInstance && filter.enabled && !filter.isDisposed,
    );
    if (enabledFilters.length === 0) {
      return false;
    }

    const parentTarget = this.currentTarget;
    if (!parentTarget) {
      return false;
    }

    const target = this.acquireRenderTarget(parentTarget.width, parentTarget.height);
    this._targetStack.push(target);
    this._filterStack.push({ filters: enabledFilters });

    this.bindTarget(target);
    this._gl.clearColor(0, 0, 0, 0);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
    return true;
  }

  popFilters() {
    if (!this._frameActive) {
      return;
    }

    this.flushSpriteBatch();
    const entry = this._filterStack.pop();
    const sourceTarget = this._targetStack.pop();
    const parentTarget = this.currentTarget;
    if (!entry || !sourceTarget || !parentTarget) {
      console.warn('WebGlRenderer.popFilters() called with an invalid stack state');
      if (sourceTarget) {
        this.recycleTarget(sourceTarget);
      }
      return;
    }

    if (!sourceTarget.texture) {
      this.recycleTarget(sourceTarget);
      this.bindTarget(parentTarget);
      return;
    }

    this.resolveRenderTarget(sourceTarget);
    let inputTexture = sourceTarget.texture;
    const transientTargets: RenderTarget[] = [];
    try {
      for (let index = 0; index < entry.filters.length; index += 1) {
        const filter = entry.filters[index];
        const last = index === entry.filters.length - 1;
        const outputTarget = last ? parentTarget : this.acquireRenderTarget(parentTarget.width, parentTarget.height);
        if (!last) {
          transientTargets.push(outputTarget);
          this.bindTarget(outputTarget);
          this._gl.clearColor(0, 0, 0, 0);
          this._gl.clear(this._gl.COLOR_BUFFER_BIT);
        }

        this.applyFilter(filter, inputTexture, outputTarget);

        if (!last && outputTarget.texture) {
          this.resolveRenderTarget(outputTarget);
          inputTexture = outputTarget.texture;
        }
      }
    } finally {
      this.recycleTarget(sourceTarget);
      for (const target of transientTargets) {
        this.recycleTarget(target);
      }
      this.bindTarget(parentTarget);
    }
  }

  pushMask() {
    if (!this._frameActive) {
      return;
    }

    this.flushSpriteBatch();
    const parentTarget = this.currentTarget;
    if (!parentTarget) {
      return;
    }

    const contentTarget = this.acquireRenderTarget(parentTarget.width, parentTarget.height);
    const maskTarget = this.acquireRenderTarget(parentTarget.width, parentTarget.height);
    this._maskStack.push({ parentTarget, contentTarget, maskTarget });
    this._targetStack.push(contentTarget);

    this.bindTarget(contentTarget);
    this._gl.clearColor(0, 0, 0, 0);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
  }

  activateMask() {
    if (!this._frameActive) {
      return;
    }

    this.flushSpriteBatch();
    const entry = this._maskStack[this._maskStack.length - 1];
    if (!entry) {
      return;
    }

    const current = this._targetStack.pop();
    if (current) {
      this.bindTarget(entry.parentTarget);
    }
    this._targetStack.push(entry.maskTarget);
    this.bindTarget(entry.maskTarget);
    this._gl.clearColor(0, 0, 0, 0);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
  }

  popMask() {
    if (!this._frameActive) {
      return;
    }

    this.flushSpriteBatch();
    const entry = this._maskStack.pop();
    const currentTarget = this._targetStack.pop();
    if (!entry || currentTarget !== entry.maskTarget) {
      console.warn('WebGlRenderer.popMask() called with an invalid stack state');
      if (entry) {
        this.recycleTarget(entry.contentTarget);
        this.recycleTarget(entry.maskTarget);
      }
      return;
    }

    if (!entry.contentTarget.texture || !entry.maskTarget.texture) {
      this.recycleTarget(entry.contentTarget);
      this.recycleTarget(entry.maskTarget);
      this.bindTarget(entry.parentTarget);
      return;
    }
    this.resolveRenderTarget(entry.contentTarget);
    this.resolveRenderTarget(entry.maskTarget);
    this.composeMaskedTexture(entry.contentTarget.texture, entry.maskTarget.texture, entry.parentTarget);
    this.recycleTarget(entry.maskTarget);
    this.recycleTarget(entry.contentTarget);
    this.bindTarget(entry.parentTarget);
  }

  resize(width: number, height: number) {
    if (this._contextLost) {
      this._canvas.width = width;
      this._canvas.height = height;
      return;
    }
    this.flushSpriteBatch();
    this.clearRenderTargetPool();
    this._canvas.width = width;
    this._canvas.height = height;
    this._gl.viewport(0, 0, width, height);
  }

  releaseTextureSource(source: HTMLImageElement | HTMLCanvasElement) {
    const gl = this._gl;
    if (this._spriteBatch?.source === source) {
      this.flushSpriteBatch();
    }
    const entry = this._sourceTextureCache.get(source);
    if (!entry) {
      return;
    }
    gl.deleteTexture(entry.texture);
    this._ownedTextures.delete(entry.texture);
    this._sourceTextureCache.delete(source);
  }

  dispose() {
    const gl = this._gl;
    for (const filter of this._filters) {
      filter.dispose();
    }
    this._filters.clear();
    this.clearRenderTargetPool();
    for (const texture of this._ownedTextures) {
      gl.deleteTexture(texture);
    }
    this._ownedTextures.clear();

    for (const framebuffer of this._ownedFramebuffers) {
      gl.deleteFramebuffer(framebuffer);
    }
    this._ownedFramebuffers.clear();
    for (const renderbuffer of this._ownedRenderbuffers) {
      gl.deleteRenderbuffer(renderbuffer);
    }
    this._ownedRenderbuffers.clear();

    for (const program of this._ownedPrograms) {
      gl.deleteProgram(program);
    }
    this._ownedPrograms.clear();

    gl.deleteBuffer(this._spriteVertexBuffer);
    gl.deleteBuffer(this._positionBuffer);
    gl.deleteBuffer(this._uvBuffer);
    gl.deleteBuffer(this._meshIndexBuffer);
    gl.deleteBuffer(this._fullscreenPositionBuffer);
    gl.deleteBuffer(this._fullscreenUvBuffer);
  }

  private get currentTarget(): RenderTarget | null {
    return this._targetStack.length > 0 ? this._targetStack[this._targetStack.length - 1] : null;
  }

  private bindTarget(target: RenderTarget) {
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, target.framebuffer);
    this._gl.viewport(0, 0, target.width, target.height);
  }

  private acquireRenderTarget(width: number, height: number): RenderTarget {
    const key = `${width}x${height}`;
    const pooled = this._renderTargetPool.get(key);
    if (pooled && pooled.length > 0) {
      return pooled.pop()!;
    }
    return this.createRenderTarget(width, height);
  }

  private recycleTarget(target: RenderTarget) {
    if (!target.framebuffer || !target.texture || target.width <= 0 || target.height <= 0) {
      return;
    }
    const key = `${target.width}x${target.height}`;
    const pooled = this._renderTargetPool.get(key);
    if (pooled) {
      pooled.push(target);
      return;
    }
    this._renderTargetPool.set(key, [target]);
  }

  private createRenderTarget(width: number, height: number): RenderTarget {
    const gl = this._gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL render target texture');
    }
    this._ownedTextures.add(texture);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.configureTextureSampling();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const resolveFramebuffer = gl.createFramebuffer();
    if (!resolveFramebuffer) {
      gl.deleteTexture(texture);
      this._ownedTextures.delete(texture);
      throw new Error('Failed to create WebGL framebuffer');
    }
    this._ownedFramebuffers.add(resolveFramebuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteTexture(texture);
      this._ownedFramebuffers.delete(resolveFramebuffer);
      this._ownedTextures.delete(texture);
      throw new Error('Failed to create complete WebGL framebuffer');
    }

    if (this._offscreenSampleCount <= 1) {
      return {
        framebuffer: resolveFramebuffer,
        resolveFramebuffer,
        texture,
        msaaRenderbuffer: null,
        width,
        height,
      };
    }

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteTexture(texture);
      this._ownedFramebuffers.delete(resolveFramebuffer);
      this._ownedTextures.delete(texture);
      throw new Error('Failed to create WebGL MSAA framebuffer');
    }
    this._ownedFramebuffers.add(framebuffer);

    const renderbuffer = gl.createRenderbuffer();
    if (!renderbuffer) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteTexture(texture);
      this._ownedFramebuffers.delete(framebuffer);
      this._ownedFramebuffers.delete(resolveFramebuffer);
      this._ownedTextures.delete(texture);
      throw new Error('Failed to create WebGL MSAA renderbuffer');
    }
    this._ownedRenderbuffers.add(renderbuffer);

    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this._offscreenSampleCount, gl.RGBA8, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteRenderbuffer(renderbuffer);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteTexture(texture);
      this._ownedRenderbuffers.delete(renderbuffer);
      this._ownedFramebuffers.delete(framebuffer);
      this._ownedFramebuffers.delete(resolveFramebuffer);
      this._ownedTextures.delete(texture);
      throw new Error('Failed to create complete WebGL MSAA framebuffer');
    }

    return {
      framebuffer,
      resolveFramebuffer,
      texture,
      msaaRenderbuffer: renderbuffer,
      width,
      height,
    };
  }

  private destroyTarget(target: RenderTarget) {
    const gl = this._gl;
    if (target.framebuffer) {
      gl.deleteFramebuffer(target.framebuffer);
      this._ownedFramebuffers.delete(target.framebuffer);
    }
    if (target.resolveFramebuffer && target.resolveFramebuffer !== target.framebuffer) {
      gl.deleteFramebuffer(target.resolveFramebuffer);
      this._ownedFramebuffers.delete(target.resolveFramebuffer);
    }
    if (target.msaaRenderbuffer) {
      gl.deleteRenderbuffer(target.msaaRenderbuffer);
      this._ownedRenderbuffers.delete(target.msaaRenderbuffer);
    }
    if (target.texture) {
      gl.deleteTexture(target.texture);
      this._ownedTextures.delete(target.texture);
    }
  }

  private resolveRenderTarget(target: RenderTarget) {
    if (
      this._offscreenSampleCount <= 1 ||
      !target.texture ||
      !target.framebuffer ||
      !target.resolveFramebuffer ||
      target.framebuffer === target.resolveFramebuffer
    ) {
      return;
    }
    const gl = this._gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.resolveFramebuffer);
    gl.blitFramebuffer(
      0,
      0,
      target.width,
      target.height,
      0,
      0,
      target.width,
      target.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  private resolveTexture(
    source: HTMLImageElement | HTMLCanvasElement,
    smooth: boolean,
    canvasRevision: number | null = null,
  ): WebGLTexture | null {
    let entry = this._sourceTextureCache.get(source) ?? null;
    if (!entry) {
      const texture = this._gl.createTexture();
      if (!texture) {
        return null;
      }
      entry = {
        texture,
        uploadedImageWidth: 0,
        uploadedImageHeight: 0,
        uploadedCanvasRevision: null,
        smooth,
      };
      this._sourceTextureCache.set(source, entry);
      this._ownedTextures.add(texture);
      this._gl.bindTexture(this._gl.TEXTURE_2D, texture);
      this.configureTextureSampling(smooth);
    } else {
      this._gl.bindTexture(this._gl.TEXTURE_2D, entry.texture);
      if (entry.smooth !== smooth) {
        this.configureTextureSampling(smooth);
        entry.smooth = smooth;
      }
    }

    if (source instanceof HTMLImageElement) {
      if (!source.complete || source.naturalWidth <= 0 || source.naturalHeight <= 0) {
        return null;
      }
      const width = source.naturalWidth;
      const height = source.naturalHeight;
      if (entry.uploadedImageWidth !== width || entry.uploadedImageHeight !== height) {
        this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, this._gl.RGBA, this._gl.UNSIGNED_BYTE, source);
        entry.uploadedImageWidth = width;
        entry.uploadedImageHeight = height;
        entry.uploadedCanvasRevision = null;
      }
      return entry.texture;
    }

    if (source.width <= 0 || source.height <= 0) {
      return null;
    }
    if (
      canvasRevision !== null &&
      entry.uploadedImageWidth === source.width &&
      entry.uploadedImageHeight === source.height &&
      entry.uploadedCanvasRevision === canvasRevision
    ) {
      return entry.texture;
    }
    this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, this._gl.RGBA, this._gl.UNSIGNED_BYTE, source);
    entry.uploadedImageWidth = source.width;
    entry.uploadedImageHeight = source.height;
    entry.uploadedCanvasRevision = canvasRevision;
    return entry.texture;
  }

  private setBlendMode(mode: RenderState['blendMode']) {
    const gl = this._gl;
    switch (mode) {
      case 'add':
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case 'subtract':
        gl.blendEquationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
        break;
      case 'multiply':
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case 'screen':
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case 'normal':
      default:
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }
  }

  private queueSpriteBatch(params: {
    source: HTMLImageElement | HTMLCanvasElement;
    sourceRevision: number | null;
    texture: WebGLTexture;
    target: RenderTarget;
    state: RenderState;
    drawWidth: number;
    drawHeight: number;
    uv: Float32Array;
    alpha: number;
    toneR: number;
    toneG: number;
    toneB: number;
    toneA: number;
  }) {
    const currentBatch = this._spriteBatch;
    if (
      !currentBatch ||
      currentBatch.target !== params.target ||
      currentBatch.texture !== params.texture ||
      currentBatch.blendMode !== params.state.blendMode ||
      currentBatch.smooth !== params.state.smooth
    ) {
      this.flushSpriteBatch();
      this._spriteBatch = {
        source: params.source,
        sourceRevision: params.sourceRevision,
        target: params.target,
        texture: params.texture,
        blendMode: params.state.blendMode,
        smooth: params.state.smooth,
        vertices: [],
      };
    }

    appendSpriteVertices(
      this._spriteBatch!.vertices,
      params.target.width,
      params.target.height,
      params.state,
      params.drawWidth,
      params.drawHeight,
      params.uv,
      {
        alpha: params.alpha,
        toneR: params.toneR,
        toneG: params.toneG,
        toneB: params.toneB,
        toneA: params.toneA,
      },
    );
  }

  private flushSpriteBatch() {
    const batch = this._spriteBatch;
    if (!batch) {
      return;
    }
    this._spriteBatch = null;
    if (batch.vertices.length === 0) {
      return;
    }
    this.drawSpriteVerticesWithProgram({
      texture: batch.texture,
      target: batch.target,
      vertices: batch.vertices,
      blendMode: batch.blendMode,
    });
  }

  private drawSpriteVerticesWithProgram(params: {
    texture: WebGLTexture;
    target: RenderTarget;
    vertices: number[];
    blendMode: RenderState['blendMode'];
  }) {
    const gl = this._gl;
    const vertexCount = Math.floor(params.vertices.length / SPRITE_VERTEX_FLOATS);
    if (vertexCount <= 0) {
      return;
    }

    this.bindTarget(params.target);
    this.setBlendMode(params.blendMode);
    gl.useProgram(this._spriteProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._spriteVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(params.vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this._spriteAPositionLocation);
    gl.vertexAttribPointer(this._spriteAPositionLocation, 2, gl.FLOAT, false, SPRITE_VERTEX_STRIDE, 0);
    gl.enableVertexAttribArray(this._spriteAUvLocation);
    gl.vertexAttribPointer(this._spriteAUvLocation, 2, gl.FLOAT, false, SPRITE_VERTEX_STRIDE, 2 * FLOAT_BYTES);
    gl.enableVertexAttribArray(this._spriteAAlphaLocation);
    gl.vertexAttribPointer(this._spriteAAlphaLocation, 1, gl.FLOAT, false, SPRITE_VERTEX_STRIDE, 4 * FLOAT_BYTES);
    gl.enableVertexAttribArray(this._spriteAToneLocation);
    gl.vertexAttribPointer(this._spriteAToneLocation, 4, gl.FLOAT, false, SPRITE_VERTEX_STRIDE, 5 * FLOAT_BYTES);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.texture);
    gl.uniform1i(this._spriteUTextureLocation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  private drawMeshWithProgram(params: {
    target: RenderTarget;
    texture: WebGLTexture;
    state: RenderState;
    positions: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array | Uint32Array;
    tint?: Color;
  }) {
    const gl = this._gl;
    const indexType = params.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    const tint = params.tint ?? { r: 255, g: 255, b: 255, a: 1 };

    this.bindTarget(params.target);
    this.setBlendMode(params.state.blendMode);
    gl.useProgram(this._meshProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, params.positions, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this._meshAPositionLocation);
    gl.vertexAttribPointer(this._meshAPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, params.uvs, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this._meshAUvLocation);
    gl.vertexAttribPointer(this._meshAUvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._meshIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, params.indices, gl.STREAM_DRAW);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.texture);
    gl.uniform1i(this._meshUTextureLocation, 0);
    gl.uniform4f(
      this._meshUToneLocation,
      clamp255(params.state.colorTone.r) / 255,
      clamp255(params.state.colorTone.g) / 255,
      clamp255(params.state.colorTone.b) / 255,
      clamp01(params.state.colorTone.a),
    );
    gl.uniform4f(
      this._meshUTintLocation,
      clamp255(tint.r) / 255,
      clamp255(tint.g) / 255,
      clamp255(tint.b) / 255,
      clamp01(params.state.alpha) * clamp01(tint.a),
    );

    gl.drawElements(gl.TRIANGLES, params.indices.length, indexType, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  private applyFilter(filter: WebGlFilterInstance, inputTexture: WebGLTexture, outputTarget: RenderTarget) {
    const gl = this._gl;

    this.bindTarget(outputTarget);
    gl.useProgram(filter.program);
    this.setBlendMode('normal');

    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenPositionBuffer);
    gl.enableVertexAttribArray(filter.aPositionLocation);
    gl.vertexAttribPointer(filter.aPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenUvBuffer);
    gl.enableVertexAttribArray(filter.aUvLocation);
    gl.vertexAttribPointer(filter.aUvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(filter.uTextureLocation, 0);
    if (filter.uUniformsLocation) {
      gl.uniform4fv(filter.uUniformsLocation, filter.uniformData);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private composeMaskedTexture(contentTexture: WebGLTexture, maskTexture: WebGLTexture, parentTarget: RenderTarget) {
    const gl = this._gl;
    this.bindTarget(parentTarget);
    gl.useProgram(this._maskProgram);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenPositionBuffer);
    gl.enableVertexAttribArray(this._maskAPositionLocation);
    gl.vertexAttribPointer(this._maskAPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenUvBuffer);
    gl.enableVertexAttribArray(this._maskAUvLocation);
    gl.vertexAttribPointer(this._maskAUvLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(this._maskUContentTextureLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(this._maskUMaskTextureLocation, 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private clearRenderTargetPool() {
    for (const targets of this._renderTargetPool.values()) {
      for (const target of targets) {
        this.destroyTarget(target);
      }
    }
    this._renderTargetPool.clear();
  }

  private configureTextureSampling(smooth = true) {
    const filter = smooth ? this._gl.LINEAR : this._gl.NEAREST;
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, filter);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, filter);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
  }

  private initializeGlResources() {
    const gl = this._gl;

    const spriteVertexShader = compileShader(gl, gl.VERTEX_SHADER, SPRITE_VERTEX_SHADER_SOURCE);
    const spriteFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, SPRITE_FRAGMENT_SHADER_SOURCE);
    this._spriteProgram = linkProgram(gl, spriteVertexShader, spriteFragmentShader);
    this._ownedPrograms.add(this._spriteProgram);
    gl.deleteShader(spriteVertexShader);
    gl.deleteShader(spriteFragmentShader);

    const meshVertexShader = compileShader(gl, gl.VERTEX_SHADER, MESH_VERTEX_SHADER_SOURCE);
    const meshFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, MESH_FRAGMENT_SHADER_SOURCE);
    this._meshProgram = linkProgram(gl, meshVertexShader, meshFragmentShader);
    this._ownedPrograms.add(this._meshProgram);
    gl.deleteShader(meshVertexShader);
    gl.deleteShader(meshFragmentShader);

    const maskVertexShader = compileShader(gl, gl.VERTEX_SHADER, MASK_VERTEX_SHADER_SOURCE);
    const maskFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, MASK_FRAGMENT_SHADER_SOURCE);
    this._maskProgram = linkProgram(gl, maskVertexShader, maskFragmentShader);
    this._ownedPrograms.add(this._maskProgram);
    gl.deleteShader(maskVertexShader);
    gl.deleteShader(maskFragmentShader);

    this._spriteAPositionLocation = getAttributeLocation(gl, this._spriteProgram, 'a_position');
    this._spriteAUvLocation = getAttributeLocation(gl, this._spriteProgram, 'a_uv');
    this._spriteAAlphaLocation = getAttributeLocation(gl, this._spriteProgram, 'a_alpha');
    this._spriteAToneLocation = getAttributeLocation(gl, this._spriteProgram, 'a_tone');
    this._spriteUTextureLocation = getUniformLocation(gl, this._spriteProgram, 'u_texture');

    this._meshAPositionLocation = getAttributeLocation(gl, this._meshProgram, 'a_position');
    this._meshAUvLocation = getAttributeLocation(gl, this._meshProgram, 'a_uv');
    this._meshUTextureLocation = getUniformLocation(gl, this._meshProgram, 'u_texture');
    this._meshUToneLocation = getUniformLocation(gl, this._meshProgram, 'u_tone');
    this._meshUTintLocation = getUniformLocation(gl, this._meshProgram, 'u_tint');

    this._maskAPositionLocation = getAttributeLocation(gl, this._maskProgram, 'a_position');
    this._maskAUvLocation = getAttributeLocation(gl, this._maskProgram, 'a_uv');
    this._maskUContentTextureLocation = getUniformLocation(gl, this._maskProgram, 'u_content_texture');
    this._maskUMaskTextureLocation = getUniformLocation(gl, this._maskProgram, 'u_mask_texture');

    const spriteVertexBuffer = gl.createBuffer();
    if (!spriteVertexBuffer) {
      throw new Error('Failed to create WebGL sprite vertex buffer');
    }
    this._spriteVertexBuffer = spriteVertexBuffer;

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      throw new Error('Failed to create WebGL position buffer');
    }
    this._positionBuffer = positionBuffer;

    const uvBuffer = gl.createBuffer();
    if (!uvBuffer) {
      throw new Error('Failed to create WebGL uv buffer');
    }
    this._uvBuffer = uvBuffer;

    const meshIndexBuffer = gl.createBuffer();
    if (!meshIndexBuffer) {
      throw new Error('Failed to create WebGL mesh index buffer');
    }
    this._meshIndexBuffer = meshIndexBuffer;

    const fullscreenPositionBuffer = gl.createBuffer();
    if (!fullscreenPositionBuffer) {
      throw new Error('Failed to create WebGL fullscreen position buffer');
    }
    this._fullscreenPositionBuffer = fullscreenPositionBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE_POSITIONS, gl.STATIC_DRAW);

    const fullscreenUvBuffer = gl.createBuffer();
    if (!fullscreenUvBuffer) {
      throw new Error('Failed to create WebGL fullscreen uv buffer');
    }
    this._fullscreenUvBuffer = fullscreenUvBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE_UV, gl.STATIC_DRAW);
  }

  private compileFilterProgram(definition: ShaderFilterDefinition): {
    program: WebGLProgram;
    aPositionLocation: number;
    aUvLocation: number;
    uTextureLocation: WebGLUniformLocation;
    uUniformsLocation: WebGLUniformLocation | null;
  } {
    const gl = this._gl;
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, FILTER_VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, createFilterFragmentSource(definition.fragment));
    const program = linkProgram(gl, vertexShader, fragmentShader);
    this._ownedPrograms.add(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return {
      program,
      aPositionLocation: getAttributeLocation(gl, program, 'a_position'),
      aUvLocation: getAttributeLocation(gl, program, 'a_uv'),
      uTextureLocation: getUniformLocation(gl, program, 'u_texture'),
      uUniformsLocation: getUniformLocationOptional(gl, program, 'u_uniforms'),
    };
  }

  private rebindFiltersAfterContextRestore() {
    for (const filter of this._filters) {
      if (filter.isDisposed) {
        this._filters.delete(filter);
        continue;
      }
      try {
        const compiled = this.compileFilterProgram(filter.definition);
        filter.rebindProgram(compiled);
      } catch (error) {
        console.warn('Failed to restore WebGL filter program. Disabling filter.', error);
        filter.dispose();
      }
    }
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }
  const error = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(`Failed to compile WebGL shader: ${error || 'unknown error'}`);
}

function linkProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create WebGL program');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program;
  }
  const error = gl.getProgramInfoLog(program);
  gl.deleteProgram(program);
  throw new Error(`Failed to link WebGL program: ${error || 'unknown error'}`);
}

function getAttributeLocation(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): number {
  const location = gl.getAttribLocation(program, name);
  if (location < 0) {
    throw new Error(`Failed to resolve WebGL attribute: ${name}`);
  }
  return location;
}

function getUniformLocation(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Failed to resolve WebGL uniform: ${name}`);
  }
  return location;
}

function getUniformLocationOptional(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

function getCanvasBackedTextureRevision(image: RenderableImage): number | null {
  return image instanceof CanvasBackedTexture ? image.revision : null;
}

function appendSpriteVertices(
  result: number[],
  targetWidth: number,
  targetHeight: number,
  state: RenderState,
  width: number,
  height: number,
  uv: Float32Array,
  color: { alpha: number; toneR: number; toneG: number; toneB: number; toneA: number },
): void {
  const p0 = applyTransform(state, 0, 0, targetWidth, targetHeight);
  const p1 = applyTransform(state, width, 0, targetWidth, targetHeight);
  const p2 = applyTransform(state, 0, height, targetWidth, targetHeight);
  const p3 = applyTransform(state, width, height, targetWidth, targetHeight);
  appendSpriteVertex(result, p0.x, p0.y, uv[0] ?? 0, uv[1] ?? 0, color);
  appendSpriteVertex(result, p1.x, p1.y, uv[2] ?? 0, uv[3] ?? 0, color);
  appendSpriteVertex(result, p2.x, p2.y, uv[4] ?? 0, uv[5] ?? 0, color);
  appendSpriteVertex(result, p2.x, p2.y, uv[6] ?? 0, uv[7] ?? 0, color);
  appendSpriteVertex(result, p1.x, p1.y, uv[8] ?? 0, uv[9] ?? 0, color);
  appendSpriteVertex(result, p3.x, p3.y, uv[10] ?? 0, uv[11] ?? 0, color);
}

function appendSpriteVertex(
  result: number[],
  x: number,
  y: number,
  u: number,
  v: number,
  color: { alpha: number; toneR: number; toneG: number; toneB: number; toneA: number },
): void {
  result.push(x, y, u, v, color.alpha, color.toneR, color.toneG, color.toneB, color.toneA);
}

function buildMeshClipSpacePositions(
  targetWidth: number,
  targetHeight: number,
  state: RenderState,
  positions: ArrayLike<number>,
  vertexCount: number,
): Float32Array {
  const result = new Float32Array(vertexCount * 2);
  for (let index = 0; index < vertexCount; index += 1) {
    const sourceIndex = index * 2;
    const p = applyTransform(
      state,
      positions[sourceIndex] ?? 0,
      positions[sourceIndex + 1] ?? 0,
      targetWidth,
      targetHeight,
    );
    result[sourceIndex] = p.x;
    result[sourceIndex + 1] = p.y;
  }
  return result;
}

function copyNumberArray(values: ArrayLike<number>, length: number): Float32Array {
  const result = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    result[index] = values[index] ?? 0;
  }
  return result;
}

function buildMeshIndices(
  indices: ArrayLike<number>,
  indexCount: number,
  vertexCount: number,
): Uint16Array | Uint32Array | null {
  let requiresUint32 = false;
  const normalized: number[] = [];
  for (let index = 0; index < indexCount; index += 1) {
    const value = Math.trunc(indices[index] ?? -1);
    if (value < 0 || value >= vertexCount) {
      return null;
    }
    if (value > 65535) {
      requiresUint32 = true;
    }
    normalized[index] = value;
  }
  return requiresUint32 ? new Uint32Array(normalized) : new Uint16Array(normalized);
}

function applyTransform(
  state: RenderState,
  x: number,
  y: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number } {
  const worldX = state.transform.a * x + state.transform.c * y + state.transform.tx;
  const worldY = state.transform.b * x + state.transform.d * y + state.transform.ty;
  return {
    x: (worldX / targetWidth) * 2 - 1,
    y: 1 - (worldY / targetHeight) * 2,
  };
}

function buildUv(image: RenderableImage, frame: Rectangle | null): Float32Array {
  if (!frame) {
    return FULLSCREEN_TRIANGLE_UV;
  }

  const u0 = frame.x / image.width;
  const v0 = frame.y / image.height;
  const u1 = (frame.x + frame.width) / image.width;
  const v1 = (frame.y + frame.height) / image.height;
  return new Float32Array([u0, v0, u1, v0, u0, v1, u0, v1, u1, v0, u1, v1]);
}

function createFilterFragmentSource(fragmentBody: string): string {
  return `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_uniforms[${WebGlRenderer.FILTER_UNIFORM_VEC4_COUNT}];
in vec2 v_uv;
out vec4 outColor;
${fragmentBody}
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 color = texture(u_texture, uv);
  outColor = applyFilter(color, uv, u_uniforms);
}
`;
}

const FLOAT_BYTES = 4;
const SPRITE_VERTEX_FLOATS = 9;
const SPRITE_VERTEX_STRIDE = SPRITE_VERTEX_FLOATS * FLOAT_BYTES;
const FULLSCREEN_TRIANGLE_POSITIONS = new Float32Array([-1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, -1]);
const FULLSCREEN_TRIANGLE_UV = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

const SPRITE_VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in float a_alpha;
in vec4 a_tone;
out vec2 v_uv;
out float v_alpha;
out vec4 v_tone;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
  v_alpha = a_alpha;
  v_tone = a_tone;
}
`;

const TEXTURED_VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
}
`;

const MESH_VERTEX_SHADER_SOURCE = TEXTURED_VERTEX_SHADER_SOURCE;

const MESH_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_tone;
uniform vec4 u_tint;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 sampled = texture(u_texture, v_uv);
  vec3 toned = mix(sampled.rgb, u_tone.rgb, u_tone.a);
  outColor = vec4(toned * u_tint.rgb, sampled.a * u_tint.a);
}
`;

const SPRITE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_uv;
in float v_alpha;
in vec4 v_tone;
out vec4 outColor;
void main() {
  vec4 sampled = texture(u_texture, v_uv);
  vec3 toned = mix(sampled.rgb, v_tone.rgb, v_tone.a);
  outColor = vec4(toned, sampled.a * v_alpha);
}
`;

const MASK_VERTEX_SHADER_SOURCE = TEXTURED_VERTEX_SHADER_SOURCE;

const MASK_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;
uniform sampler2D u_content_texture;
uniform sampler2D u_mask_texture;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 content = texture(u_content_texture, uv);
  float maskAlpha = texture(u_mask_texture, uv).a;
  outColor = vec4(content.rgb, content.a * maskAlpha);
}
`;

const FILTER_VERTEX_SHADER_SOURCE = TEXTURED_VERTEX_SHADER_SOURCE;
