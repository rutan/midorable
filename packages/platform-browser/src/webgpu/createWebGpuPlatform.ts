import { WebGpuPlatform, WebGpuPlatformConfig } from './WebGpuPlatform';

export async function createWebGpuPlatform(config: WebGpuPlatformConfig): Promise<WebGpuPlatform> {
  const platform = new WebGpuPlatform(config);
  await platform.init();
  return platform;
}
