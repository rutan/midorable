import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../src/core';
import { audioAsset, imageAsset } from '../../src/core/asset';
import { Loader } from '../../src/core/Loader';
import { createImageAsset, createMockPlatform } from '../helpers/createMockPlatform';

describe('Loader cache', () => {
  it('deduplicates in-flight loads for same key', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    const deferred = Promise.resolve(asset);
    platform.loadAsset = vi.fn(() => deferred);
    const loader = new Loader(platform);

    const p1 = loader.load(imageAsset('/hero.png'));
    const p2 = loader.load(imageAsset('/hero.png'));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(platform.loadAsset).toHaveBeenCalledTimes(1);
    expect(r1).toBe(asset);
    expect(r2).toBe(asset);
  });

  it('returns cached asset after first load', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.loadAsset = vi.fn(async () => asset);
    const loader = new Loader(platform);

    const first = await loader.load(imageAsset('/hero.png'));
    const second = await loader.load(imageAsset('/hero.png'));

    expect(platform.loadAsset).toHaveBeenCalledTimes(1);
    expect(first).toBe(asset);
    expect(second).toBe(asset);
  });

  it('clears in-flight state after failure and allows retry', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.loadAsset = vi.fn().mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(asset);
    const loader = new Loader(platform);

    await expect(loader.load(imageAsset('/hero.png'))).rejects.toThrow('network error');
    const retried = await loader.load(imageAsset('/hero.png'));

    expect(platform.loadAsset).toHaveBeenCalledTimes(2);
    expect(retried).toBe(asset);
  });

  it('retries failed loads up to maxRetries', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.loadAsset = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary error 1'))
      .mockRejectedValueOnce(new Error('temporary error 2'))
      .mockResolvedValueOnce(asset);
    const loader = new Loader(platform);

    const loaded = await loader.load(imageAsset('/hero.png'), {
      retry: { maxRetries: 2 },
    });

    expect(platform.loadAsset).toHaveBeenCalledTimes(3);
    expect(loaded).toBe(asset);
  });

  it('waits retry delay before retrying', async () => {
    vi.useFakeTimers();
    try {
      const { platform } = createMockPlatform();
      const asset = createImageAsset('hero');
      platform.loadAsset = vi.fn().mockRejectedValueOnce(new Error('temporary error')).mockResolvedValueOnce(asset);
      const loader = new Loader(platform);

      const promise = loader.load(imageAsset('/hero.png'), {
        retry: { maxRetries: 1, delay: 100 },
      });

      await Promise.resolve();
      expect(platform.loadAsset).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(99);
      expect(platform.loadAsset).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe(asset);
      expect(platform.loadAsset).toHaveBeenCalledTimes(2);
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
    expect(platform.loadAsset).not.toHaveBeenCalled();
  });

  it('aborts the shared platform load after all waiting callers abort', async () => {
    const { platform } = createMockPlatform();
    platform.loadAsset = vi.fn(
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
    expect(platform.loadAsset).toHaveBeenCalledTimes(1);

    controller2.abort();
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });
    expect(platform.loadAsset).toHaveBeenCalledTimes(1);
  });

  it('uses custom key to reuse cached asset', async () => {
    const { platform } = createMockPlatform();
    const asset = createImageAsset('hero');
    platform.loadAsset = vi.fn(async () => asset);
    const loader = new Loader(platform);

    const first = await loader.load(imageAsset('/hero-v1.png'), { key: 'hero' });
    const second = await loader.load(imageAsset('/hero-v2.png'), { key: 'hero' });

    expect(platform.loadAsset).toHaveBeenCalledTimes(1);
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
    platform.loadAsset = vi.fn(
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
});
