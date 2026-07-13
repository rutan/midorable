import {
  AudioAsset,
  BinaryAsset,
  ImageAsset,
  MediaQuery,
  MediaSupportLevel,
  TextAsset,
} from '@rutan/midorable/platform';

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

declare module '@rutan/midorable/platform' {
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
