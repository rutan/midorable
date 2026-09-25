import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../src';
import { Loader } from '../../src/engine/Loader';
import { audioAsset, imageAsset } from '../../src/platform/assets';
import { createImageAsset, createMockPlatform } from '../helpers/createMockPlatform';

describe('Loader cache', () => {
  it('deduplicates in-flight loads for same key', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    const deferred = Promise.resolve(asset);
    platform.assets.load = vi.fn(() => deferred);
    const loader = new Loader(platform);

    const p1 = loader.load(imageAsset('/hero.png'));
    const p2 = loader.load(imageAsset('/hero.png'));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(platform.assets.load).toHaveBeenCalledTimes(1);
    expect(r1).toBe(asset);
    expect(r2).toBe(asset);
  });

  it('returns cached asset after first load', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.assets.load = vi.fn(async () => asset);
    const loader = new Loader(platform);

    const first = await loader.load(imageAsset('/hero.png'));
    const second = await loader.load(imageAsset('/hero.png'));

    expect(platform.assets.load).toHaveBeenCalledTimes(1);
    expect(first).toBe(asset);
    expect(second).toBe(asset);
  });

  it('clears in-flight state after failure and allows retry', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.assets.load = vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(asset);
    const loader = new Loader(platform);

    await expect(loader.load(imageAsset('/hero.png'))).rejects.toThrow('network error');
    const retried = await loader.load(imageAsset('/hero.png'));

    expect(platform.assets.load).toHaveBeenCalledTimes(2);
    expect(retried).toBe(asset);
  });

  it('retries failed loads up to maxRetries', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.assets.load = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary error 1'))
      .mockRejectedValueOnce(new Error('temporary error 2'))
      .mockResolvedValueOnce(asset);
    const loader = new Loader(platform);

    const loaded = await loader.load(imageAsset('/hero.png'), {
      retry: { maxRetries: 2 },
    });

    expect(platform.assets.load).toHaveBeenCalledTimes(3);
    expect(loaded).toBe(asset);
  });

  it('waits retry delay before retrying', async () => {
    vi.useFakeTimers();
    try {
      const { platform } = createMockPlatform();
      const asset = createImageAsset('hero');
      platform.assets.load = vi.fn().mockRejectedValueOnce(new Error('temporary error')).mockResolvedValueOnce(asset);
      const loader = new Loader(platform);

      const promise = loader.load(imageAsset('/hero.png'), {
        retry: { maxRetries: 1, delay: 100 },
      });

      await Promise.resolve();
      expect(platform.assets.load).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(99);
      expect(platform.assets.load).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe(asset);
      expect(platform.assets.load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects immediately when signal is already aborted', async () => {
    const { platform } = createMockPlatform();
    const controller = new AbortController();
    controller.abort();
    const loader = new Loader(platform);

    await expect(loader.load(imageAsset('/hero.png'), { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(platform.assets.load).not.toHaveBeenCalled();
  });

  it('aborts the shared platform load after all waiting callers abort', async () => {
    const { platform } = createMockPlatform();
    platform.assets.load = vi.fn(
      async (_spec, options?: { signal?: AbortSignal }): Promise<Asset> =>
        new Promise<Asset>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const loader = new Loader(platform);
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    const p1 = loader.load(imageAsset('/hero.png'), { signal: controller1.signal });
    const p2 = loader.load(imageAsset('/hero.png'), { signal: controller2.signal });

    controller1.abort();
    await expect(p1).rejects.toMatchObject({ name: 'AbortError' });
    expect(platform.assets.load).toHaveBeenCalledTimes(1);

    controller2.abort();
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
    expect(platform.assets.load).toHaveBeenCalledTimes(1);
  });

  it('uses custom key to reuse cached asset', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.assets.load = vi.fn(async () => asset);
    const loader = new Loader(platform);

    const first = await loader.load(imageAsset('/hero-v1.png'), { key: 'hero' });
    const second = await loader.load(imageAsset('/hero-v2.png'), { key: 'hero' });

    expect(platform.assets.load).toHaveBeenCalledTimes(1);
    expect(first).toBe(asset);
    expect(second).toBe(asset);
  });

  it('rejects reusing the same key for a different asset type', async () => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);

    await loader.load(imageAsset('/hero.png'), { key: 'hero' });

    expect(() => loader.load(audioAsset('/hero.ogg'), { key: 'hero' })).toThrow(
      'Asset key "hero" is already cached as image, but audio was requested',
    );
  });

  it('rejects joining an in-flight load with a different asset type', async () => {
    const { platform } = createMockPlatform();
    let rejectLoad!: (error: Error) => void;
    platform.assets.load = vi.fn(
      () =>
        new Promise<Asset>((_resolve, reject) => {
          rejectLoad = reject;
        }),
    );
    const loader = new Loader(platform);

    const pending = loader.load(imageAsset('/hero.png'), { key: 'hero' });

    expect(() => loader.load(audioAsset('/hero.ogg'), { key: 'hero' })).toThrow(
      'Asset key "hero" is already loading as image, but audio was requested',
    );

    rejectLoad(new Error('cancel test load'));
    await expect(pending).rejects.toThrow('cancel test load');
  });

  it('checks the cached request type even if the returned asset is mutated', async () => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);
    const asset: Asset = await loader.load(imageAsset('/hero.png'), { key: 'hero' });

    asset.type = 'audio';

    expect(() => loader.load(audioAsset('/hero.ogg'), { key: 'hero' })).toThrow(
      'Asset key "hero" is already cached as image, but audio was requested',
    );
  });

  it.each(['unload', 'unloadAllAssets'] as const)('allows a different asset type after %s', async (method) => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);
    const asset = await loader.load(imageAsset('/hero.png'), { key: 'hero' });

    if (method === 'unload') {
      await loader.unload(asset);
    } else {
      await loader.unloadAllAssets();
    }

    const replacement = await loader.load(audioAsset('/hero.ogg'), { key: 'hero' });
    expect(replacement.type).toBe('audio');
    expect(loader.get('hero')).toBe(replacement);
    expect(platform.assets.load).toHaveBeenCalledTimes(2);
  });
});

it('keeps the shared request alive when one caller cancels', async () => {
  const { platform } = createMockPlatform();
  const asset = createImageAsset('shared');
  const backend = Promise.withResolvers<typeof asset>();
  platform.assets.load = vi.fn(() => backend.promise);
  const loader = new Loader(platform);
  const controller = new AbortController();
  const first = loader.load(imageAsset('/shared.png'), { signal: controller.signal });
  const second = loader.load(imageAsset('/shared.png'));
  controller.abort();
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  expect(platform.assets.load.mock.calls[0]![1]!.signal!.aborted).toBe(false);
  backend.resolve(asset);
  await expect(second).resolves.toBe(asset);
  expect(loader.get('/shared.png')).toBe(asset);
  expect(platform.assets.unload).not.toHaveBeenCalled();
  await loader.dispose();
});

it('does not let an old cancelled request remove its in-flight replacement', async () => {
  const { platform } = createMockPlatform();
  const oldAsset = createImageAsset('old');
  const newAsset = createImageAsset('new');
  const oldBackend = Promise.withResolvers<typeof oldAsset>();
  const newBackend = Promise.withResolvers<typeof newAsset>();
  const oldUnloaded = Promise.withResolvers<void>();
  platform.assets.load = vi.fn().mockReturnValueOnce(oldBackend.promise).mockReturnValueOnce(newBackend.promise);
  platform.assets.unload.mockImplementation(() => oldUnloaded.resolve());
  const loader = new Loader(platform);
  const controller = new AbortController();
  const first = loader.load(imageAsset('/same.png'), { signal: controller.signal });
  controller.abort();
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = loader.load(imageAsset('/same.png'));
  oldBackend.resolve(oldAsset);
  await oldUnloaded.promise;
  const third = loader.load(imageAsset('/same.png'));
  expect(platform.assets.load).toHaveBeenCalledTimes(2);
  newBackend.resolve(newAsset);
  await expect(second).resolves.toBe(newAsset);
  await expect(third).resolves.toBe(newAsset);
  expect(loader.get('/same.png')).toBe(newAsset);
  expect(platform.assets.unload).toHaveBeenCalledExactlyOnceWith(oldAsset);
  await loader.dispose();
});
