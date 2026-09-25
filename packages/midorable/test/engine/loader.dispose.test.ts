import { describe, expect, it, vi } from 'vitest';
import { Loader } from '../../src/engine/Loader';
import { imageAsset } from '../../src/platform/assets';
import { createImageAsset, createMockPlatform } from '../helpers/createMockPlatform';

describe('Loader disposal during loading', () => {
  it('cancels all callers immediately and waits to unload a late shared result once', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('late');
    const backend = Promise.withResolvers<typeof asset>();
    platform.assets.load = vi.fn(() => backend.promise);
    const onDispose = vi.fn();
    const loader = new Loader(platform, { onDispose });
    const first = loader.load(imageAsset('/late.png'));
    const second = loader.load(imageAsset('/late.png'), { signal: new AbortController().signal });
    const signal = platform.assets.load.mock.calls[0]![1]!.signal!;

    const finished = vi.fn();
    const disposing = loader.dispose().then(finished);
    const disposingAgain = loader.dispose().then(finished);
    expect(loader.disposed).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(() => loader.load(imageAsset('/new.png'))).toThrow('Loader has been disposed');
    expect(() => loader.get('/late.png')).toThrow('Loader has been disposed');
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(finished).not.toHaveBeenCalled();
    expect(onDispose).not.toHaveBeenCalled();

    backend.resolve(asset);
    await Promise.all([disposing, disposingAgain]);
    await loader.dispose();
    expect(platform.assets.load).toHaveBeenCalledTimes(1);
    expect(platform.assets.unload).toHaveBeenCalledExactlyOnceWith(asset);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it.each(['abort', 'late failure'])('finishes cleanup when the backend rejects with %s', async (outcome) => {
    const { platform } = createMockPlatform();
    const backend = Promise.withResolvers<never>();
    platform.assets.load = vi.fn((_spec, options) => {
      if (outcome === 'abort') {
        options.signal.addEventListener('abort', () => {
          backend.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }
      return backend.promise;
    });
    const loader = new Loader(platform);
    const pending = loader.load(imageAsset('/late.png'), { retry: { maxRetries: 2, delay: 100 } });
    const disposing = loader.dispose();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    if (outcome === 'late failure') backend.reject(new Error('network failed'));
    await disposing;
    expect(platform.assets.load).toHaveBeenCalledTimes(1);
    expect(platform.assets.unload).not.toHaveBeenCalled();
  });

  it('stops retry waits on disposal', async () => {
    vi.useFakeTimers();
    try {
      const { platform } = createMockPlatform();
      platform.assets.load = vi.fn().mockRejectedValue(new Error('temporary failure'));
      const loader = new Loader(platform);
      const pending = loader.load(imageAsset('/retry.png'), { retry: { maxRetries: 2, delay: 1000 } });
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);

      const disposing = loader.dispose();
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await disposing;
      expect(vi.getTimerCount()).toBe(0);
      expect(platform.assets.load).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues cleanup and reports cached and late unload failures', async () => {
    const { platform } = createMockPlatform();
    const cached = createImageAsset('cached');
    const other = createImageAsset('other');
    const late = createImageAsset('late');
    const backend = Promise.withResolvers<typeof late>();
    platform.assets.load = vi
      .fn()
      .mockResolvedValueOnce(cached)
      .mockResolvedValueOnce(other)
      .mockReturnValueOnce(backend.promise);
    const cachedError = new Error('cached unload failed');
    const lateError = new Error('late unload failed');
    platform.assets.unload = vi.fn((asset) => {
      if (asset === cached) throw cachedError;
      if (asset === late) throw lateError;
    });
    const onDispose = vi.fn();
    const loader = new Loader(platform, { onDispose });
    await loader.load(imageAsset('/cached.png'));
    await loader.load(imageAsset('/other.png'));
    const pending = loader.load(imageAsset('/late.png'));
    const disposing = loader.dispose();
    const assertion = expect(disposing).rejects.toMatchObject({ errors: [cachedError, lateError] });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    backend.resolve(late);
    await assertion;
    await expect(loader.dispose()).rejects.toBeInstanceOf(AggregateError);
    expect(platform.assets.unload).toHaveBeenCalledTimes(3);
    expect(platform.assets.unload).toHaveBeenCalledWith(other);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps cancelled loads in cleanup even after a new request replaces their key', async () => {
    const { platform } = createMockPlatform();
    const oldAsset = createImageAsset('old');
    const newAsset = createImageAsset('new');
    const oldBackend = Promise.withResolvers<typeof oldAsset>();
    const newBackend = Promise.withResolvers<typeof newAsset>();
    platform.assets.load = vi.fn().mockReturnValueOnce(oldBackend.promise).mockReturnValueOnce(newBackend.promise);
    const loader = new Loader(platform);
    const controller = new AbortController();
    const first = loader.load(imageAsset('/same.png'), { signal: controller.signal });
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = loader.load(imageAsset('/same.png'));
    newBackend.resolve(newAsset);
    await expect(second).resolves.toBe(newAsset);

    const finished = vi.fn();
    const disposing = loader.dispose().then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    oldBackend.resolve(oldAsset);
    await disposing;
    expect(platform.assets.unload).toHaveBeenCalledTimes(2);
    expect(platform.assets.unload).toHaveBeenCalledWith(oldAsset);
    expect(platform.assets.unload).toHaveBeenCalledWith(newAsset);
  });
});
