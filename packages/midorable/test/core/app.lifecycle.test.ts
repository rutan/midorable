import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/core/App';
import { createMockPlatform } from '../helpers/createMockPlatform';

describe('App lifecycle', () => {
  it('start is idempotent and starts loop once', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });

    await app.start();
    await app.start();

    expect(platform.startLoop).toHaveBeenCalledTimes(1);
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

    expect(platform.stopLoop).toHaveBeenCalledTimes(1);
    expect(defaultLoaderDispose).toHaveBeenCalledTimes(1);
    expect(extraLoaderDispose).toHaveBeenCalledTimes(1);
    expect(rootDispose).toHaveBeenCalledTimes(1);
    expect(platform.dispose).toHaveBeenCalledTimes(1);
  });

  it('render calls renderer frame operations', () => {
    const { platform, renderer } = createMockPlatform();
    const app = new App({ platform });

    app.render();

    expect(renderer.beginFrame).toHaveBeenCalledTimes(1);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.endFrame).toHaveBeenCalledTimes(1);
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
});
