import {
  AudioAsset,
  BinaryAsset,
  ImageAsset,
  MediaQuery,
  MediaSupportLevel,
  RenderState,
  RenderableImage,
  DrawTexturedTrianglesParams,
  TextAsset,
} from '@rutan/midorable';

export type HeadlessDrawCommand =
  | { type: 'clear'; color: { r: number; g: number; b: number; a: number } }
  | { type: 'drawSprite'; image: RenderableImage; state: RenderState }
  | {
      type: 'drawSpriteFrame';
      image: RenderableImage;
      state: RenderState;
      frame: { x: number; y: number; width: number; height: number };
    }
  | {
      type: 'drawTexturedTriangles';
      image: RenderableImage;
      state: RenderState;
      positions: readonly number[];
      uvs: readonly number[];
      indices: readonly number[];
      tint?: DrawTexturedTrianglesParams['tint'];
    }
  | { type: 'pushMask' }
  | { type: 'activateMask' }
  | { type: 'popMask' };

export interface HeadlessResourceConfig {
  fetch?: (url: string, options?: { signal?: AbortSignal }) => Promise<Response>;
  fetchText?: (url: string, options?: { signal?: AbortSignal }) => Promise<string>;
  fetchBinary?: (url: string, options?: { signal?: AbortSignal }) => Promise<ArrayBuffer>;
  loadImage?: (url: string, options?: { signal?: AbortSignal }) => Promise<ImageAsset>;
  loadAudio?: (url: string, options?: { signal?: AbortSignal }) => Promise<AudioAsset>;
}

export interface HeadlessPlatformConfig {
  width?: number;
  height?: number;
  now?: () => number;
  schedule?: (callback: (now: number) => void) => () => void;
  mediaQuery?: (query: MediaQuery) => MediaSupportLevel;
  resource?: HeadlessResourceConfig;
  rendererMode?: 'noop' | 'record';
}

export interface HeadlessPlatformFeatureRegistry {
  headless: {
    rendererMode: 'noop' | 'record';
  };
}

declare module '@rutan/midorable' {
  interface PlatformFeatureRegistry extends HeadlessPlatformFeatureRegistry {}
}

export type HeadlessTextureCommand =
  | { type: 'drawLine'; sx: number; sy: number; ex: number; ey: number }
  | { type: 'drawRect'; x: number; y: number; width: number; height: number; fill: boolean }
  | { type: 'drawText'; text: string; x: number; y: number }
  | {
      type: 'drawImage';
      sx: number;
      sy: number;
      sw: number;
      sh: number;
      dx: number;
      dy: number;
      dw: number;
      dh: number;
    }
  | { type: 'clear' };

export interface HeadlessLoadedAssetSet {
  image: Map<string, Promise<ImageAsset>>;
  audio: Map<string, Promise<AudioAsset>>;
  text: Map<string, Promise<TextAsset>>;
  binary: Map<string, Promise<BinaryAsset>>;
}
