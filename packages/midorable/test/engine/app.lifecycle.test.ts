import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/engine/App';
import { createImageAsset, createMockPlatform } from '../helpers/createMockPlatform';

describe('App lifecycle', () => {
  it('applies a logical size change before notifying listeners while running', async () => {
    const { platform, host } = createMockPlatform();
    const app = new App({ platform, width: 800, height: 600 });
    await app.start();
    const layout = vi.fn(() => {
      expect(host.resize).toHaveBeenLastCalledWith(1280, 720);
      expect([app.width, app.height]).toEqual([1280, 720]);
    });
    app.onLogicalSizeChanged.on(layout);
    app.setLogicalSize(1280, 720);
    app.setLogicalSize(1280, 720);

    expect(host.resize.mock.calls).toEqual([
      [800, 600],
      [1280, 720],
    ]);
    expect(layout).toHaveBeenCalledExactlyOnceWith({ width: 1280, height: 720 });
    expect(host.stopLoop).not.toHaveBeenCalled();
    await app.dispose();
  });

  it('preserves the current size when a logical size is invalid', () => {
    const { platform, host } = createMockPlatform();
    const app = new App({ platform });
    const layout = vi.fn();
    app.onLogicalSizeChanged.on(layout);

    for (const invalid of [0, -1, 1.5, Infinity, NaN]) {
      expect(() => app.setLogicalSize(invalid, 600)).toThrow(RangeError);
      expect(() => app.setLogicalSize(800, invalid)).toThrow(RangeError);
    }
    expect([app.width, app.height]).toEqual([800, 600]);
    expect(host.resize).toHaveBeenCalledTimes(1);
    expect(layout).not.toHaveBeenCalled();
  });

  it('start is idempotent and starts loop once', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });

    await app.start();
    await app.start();

    expect(platform.host.startLoop).toHaveBeenCalledTimes(1);
  });

  it('limits fixed updates per tick', async () => {
    const mock = createMockPlatform();
    const app = new App({ platform: mock.platform, fps: 60 });
    const updateSpy = vi.spyOn(app, 'update');
    const renderSpy = vi.spyOn(app, 'render');
    await app.start();

    mock.triggerTick(0);
    mock.triggerTick(1000);
    mock.triggerTick(2000);

    expect(updateSpy).toHaveBeenCalledTimes(11);
    expect(renderSpy).toHaveBeenCalledTimes(3);
  });

  it('dispose unloads loaders and disposes resources', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const rootDispose = vi.spyOn(app.root, 'dispose');
    const defaultLoaderDispose = vi.spyOn(app.context.loader, 'dispose');
    const extraLoader = app.createLoader();
    const extraLoaderDispose = vi.spyOn(extraLoader, 'dispose');
    await app.start();

    await app.dispose();

    expect(platform.host.stopLoop).toHaveBeenCalledTimes(1);
    expect(defaultLoaderDispose).toHaveBeenCalledTimes(1);
    expect(extraLoaderDispose).toHaveBeenCalledTimes(1);
    expect(rootDispose).toHaveBeenCalledTimes(1);
    expect(platform.dispose).toHaveBeenCalledTimes(1);
  });

  it('render calls renderer frame operations', () => {
    const { platform, renderer } = createMockPlatform();
    const app = new App({ platform });

    app.render();

    expect(renderer.submitFrame).toHaveBeenCalledTimes(1);
    expect(renderer.submitFrame.mock.calls[0]?.[0].commands).toEqual([]);
  });

  it('exposes graphics capabilities from the graphics backend', () => {
    const { platform, graphics } = createMockPlatform();
    graphics.capabilities = {
      filters: {
        shaderLanguages: ['test-shader'],
        maxUniformVectors: 16,
      },
    };
    const app = new App({ platform });

    expect(app.graphicsCapabilities).toEqual({
      filters: { shaderLanguages: ['test-shader'], maxUniformVectors: 16 },
    });
  });

  it('tracks runtime stats from the main loop', async () => {
    const mock = createMockPlatform();
    const app = new App({ platform: mock.platform, fps: 60 });
    await app.start();

    mock.triggerTick(1);
    mock.triggerTick(101);
    expect(app.stats.frameDeltaMs).toBe(100);
    expect(app.stats.actualFps).toBe(0);

    mock.triggerTick(301);
    expect(app.stats.frameDeltaMs).toBe(200);
    expect(app.stats.actualFps).toBeCloseTo(10, 5);
  });

  it('snaps near-target frame timing to avoid alternating skipped updates', async () => {
    const mock = createMockPlatform();
    const app = new App({ platform: mock.platform, fps: 60 });
    const updateSpy = vi.spyOn(app, 'update');
    await app.start();

    mock.triggerTick(1);
    mock.triggerTick(17.2);
    mock.triggerTick(34.6);

    expect(updateSpy).toHaveBeenCalledTimes(2);
  });

  it('snaps small remainder after multiple catch-up updates', async () => {
    const mock = createMockPlatform();
    const app = new App({ platform: mock.platform, fps: 60 });
    const updateSpy = vi.spyOn(app, 'update');
    await app.start();

    mock.triggerTick(1);
    mock.triggerTick(51.2);
    mock.triggerTick(68.6);

    expect(updateSpy).toHaveBeenCalledTimes(4);
  });
});

it('waits for late assets to be unloaded before disposing the platform', async () => {
  const { platform } = createMockPlatform();
  const asset = createImageAsset('late');
  const backend = Promise.withResolvers<typeof asset>();
  platform.assets.load = vi.fn(() => backend.promise);
  const app = new App({ platform });
  const pending = app.context.loader.load({ type: 'image', src: '/late.png' });
  const disposing = app.dispose();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(platform.dispose).not.toHaveBeenCalled();
  platform.assets.unload.mockImplementation(() => {
    expect(platform.dispose).not.toHaveBeenCalled();
  });
  backend.resolve(asset);
  await disposing;
  expect(platform.assets.unload).toHaveBeenCalledExactlyOnceWith(asset);
  expect(platform.dispose).toHaveBeenCalledTimes(1);
});
