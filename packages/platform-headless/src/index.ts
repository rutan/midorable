import { HeadlessPlatform } from './HeadlessPlatform';
import { HeadlessPlatformConfig } from './types';

export async function createHeadlessPlatform(config: HeadlessPlatformConfig = {}): Promise<HeadlessPlatform> {
  return new HeadlessPlatform(config);
}

export * from './HeadlessAudioBackend';
export * from './HeadlessInput';
export * from './HeadlessPlatform';
export * from './HeadlessRenderer';
export * from './HeadlessResourceStore';
export * from './HeadlessTexture';
export * from './types';
