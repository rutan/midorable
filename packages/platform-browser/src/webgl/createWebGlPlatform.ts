import { WebGlPlatform, WebGlPlatformConfig } from './WebGlPlatform';

export async function createWebGlPlatform(config: WebGlPlatformConfig): Promise<WebGlPlatform> {
  const platform = new WebGlPlatform(config);
  await platform.init();
  return platform;
}
