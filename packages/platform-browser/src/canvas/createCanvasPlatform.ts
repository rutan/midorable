import { CanvasPlatform, CanvasPlatformConfig } from './CanvasPlatform';

export async function createCanvasPlatform(config: CanvasPlatformConfig): Promise<CanvasPlatform> {
  const platform = new CanvasPlatform(config);
  await platform.init();
  return platform;
}
