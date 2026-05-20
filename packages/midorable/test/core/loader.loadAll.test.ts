import { describe, expect, it, vi } from 'vitest';
import type { AssetSpec, AudioAsset, ImageAsset } from '../../src/core';
import { audioAsset, imageAsset } from '../../src/core/asset';
import { Loader } from '../../src/core/Loader';
import { createAudioAsset, createImageAsset, createMockPlatform } from '../helpers/createMockPlatform';

describe('Loader loadAll', () => {
  it('loads multiple assets and returns them by key', async () => {
    const { platform } = createMockPlatform();
    const dog = createImageAsset('dog');
    const bgm = createAudioAsset('bgm');
    platform.loadAsset = vi.fn(async (spec) => {
      switch (spec.type) {
        case 'image':
          return dog;
        case 'audio':
          return bgm;
        default:
          throw new Error('unexpected asset type');
      }
    });
    const loader = new Loader(platform);

    const assets = await loader.loadAll({
      dog: imageAsset('/dog.png'),
      bgm: audioAsset('/bgm.mp3'),
    });

    expect(assets.dog).toBe(dog);
    expect(assets.bgm).toBe(bgm);
    expect(loader.get('dog')).toBe(dog);
    expect(loader.get('bgm')).toBe(bgm);
    expect(platform.loadAsset).toHaveBeenCalledTimes(2);
  });

  it('reuses cached assets by object keys', async () => {
    const { platform } = createMockPlatform();
    const dog = createImageAsset('dog');
    platform.loadAsset = vi.fn(async () => dog);
    const loader = new Loader(platform);

    const first = await loader.loadAll({
      dog: imageAsset('/dog-v1.png'),
    });
    const second = await loader.loadAll({
      dog: imageAsset('/dog-v2.png'),
    });

    expect(first.dog).toBe(dog);
    expect(second.dog).toBe(dog);
    expect(platform.loadAsset).toHaveBeenCalledTimes(1);
  });

  it('passes retry options to each load and creates platform abort signals', async () => {
    const { platform } = createMockPlatform();
    const dog = createImageAsset('dog');
    const bgm = createAudioAsset('bgm');
    const calls: { key: string; signal?: AbortSignal }[] = [];
    platform.loadAsset = vi.fn(async (spec, options?: { signal?: AbortSignal }) => {
      calls.push({ key: spec.src, signal: options?.signal });
      if (spec.src === '/dog.png' && calls.filter((call) => call.key === '/dog.png').length === 1) {
        throw new Error('temporary failure');
      }
      return spec.type === 'image' ? dog : bgm;
    });
    const loader = new Loader(platform);

    const assets = await loader.loadAll(
      {
        dog: imageAsset('/dog.png'),
        bgm: audioAsset('/bgm.mp3'),
      },
      {
        retry: { maxRetries: 1 },
      },
    );

    expect(assets.dog).toBe(dog);
    expect(assets.bgm).toBe(bgm);
    expect(platform.loadAsset).toHaveBeenCalledTimes(3);
    expect(calls.map((call) => call.key)).toEqual(['/dog.png', '/bgm.mp3', '/dog.png']);
    expect(calls.every((call) => call.signal instanceof AbortSignal)).toBe(true);
  });

  it('rejects when loadAll signal is already aborted', async () => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);
    const controller = new AbortController();
    controller.abort();

    await expect(
      loader.loadAll(
        {
          dog: imageAsset('/dog.png'),
          bgm: audioAsset('/bgm.mp3'),
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(platform.loadAsset).not.toHaveBeenCalled();
  });

  it('preserves per-key asset types', async () => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);

    const assets = await loader.loadAll({
      dog: imageAsset('/dog.png'),
      bgm: audioAsset('/bgm.mp3'),
    });

    const dog: ImageAsset = assets.dog;
    const bgm: AudioAsset = assets.bgm;

    expect(dog.type).toBe('image');
    expect(bgm.type).toBe('audio');
  });

  it('reports load progress through onProgress', async () => {
    const { platform } = createMockPlatform();
    const dog = createImageAsset('dog');
    const bgm = createAudioAsset('bgm');
    platform.loadAsset = vi.fn(async (spec) => {
      return spec.type === 'image' ? dog : bgm;
    });
    const loader = new Loader(platform);
    const snapshots: Array<{
      progress: { total: number; completed: number; failed: number; pending: number };
      currentAsset?: { key: string; type: string; src: string };
    }> = [];

    await loader.loadAll(
      {
        dog: imageAsset('/dog.png'),
        bgm: audioAsset('/bgm.mp3'),
      },
      {
        onProgress: async (snapshot) => {
          snapshots.push({
            progress: { ...snapshot.progress },
            currentAsset: snapshot.currentAsset ? { ...snapshot.currentAsset } : undefined,
          });
        },
      },
    );

    expect(snapshots[0]).toEqual({
      progress: { total: 2, completed: 0, failed: 0, pending: 2 },
      currentAsset: undefined,
    });
    expect(snapshots).toContainEqual({
      progress: { total: 2, completed: 1, failed: 0, pending: 1 },
      currentAsset: { key: 'dog', type: 'image', src: '/dog.png' },
    });
    expect(snapshots).toContainEqual({
      progress: { total: 2, completed: 2, failed: 0, pending: 0 },
      currentAsset: { key: 'bgm', type: 'audio', src: '/bgm.mp3' },
    });
  });

  it('reports failed progress before rejecting', async () => {
    const { platform } = createMockPlatform();
    platform.loadAsset = vi.fn(async (spec) => {
      if (spec.src === '/dog.png') {
        throw new Error('load failed');
      }
      return createAudioAsset('bgm');
    });
    const loader = new Loader(platform);
    const snapshots: Array<{
      progress: { total: number; completed: number; failed: number; pending: number };
      currentAsset?: { key: string; type: string; src: string };
    }> = [];

    await expect(
      loader.loadAll(
        {
          dog: imageAsset('/dog.png'),
          bgm: audioAsset('/bgm.mp3'),
        },
        {
          onProgress: (snapshot) => {
            snapshots.push({
              progress: { ...snapshot.progress },
              currentAsset: snapshot.currentAsset ? { ...snapshot.currentAsset } : undefined,
            });
          },
        },
      ),
    ).rejects.toThrow('load failed');

    expect(snapshots[0]).toEqual({
      progress: { total: 2, completed: 0, failed: 0, pending: 2 },
      currentAsset: undefined,
    });
    expect(snapshots).toContainEqual({
      progress: { total: 2, completed: 0, failed: 1, pending: 1 },
      currentAsset: { key: 'dog', type: 'image', src: '/dog.png' },
    });
  });

  it('limits concurrent loads when concurrency is specified', async () => {
    const { platform } = createMockPlatform();
    const pendingResolves: Array<() => void> = [];
    const started: string[] = [];
    let activeLoads = 0;
    let maxActiveLoads = 0;

    platform.loadAsset = vi.fn(
      (spec: AssetSpec) =>
        new Promise<ImageAsset>((resolve) => {
          started.push(spec.src);
          activeLoads += 1;
          maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
          pendingResolves.push(() => {
            activeLoads -= 1;
            resolve(createImageAsset(spec.src));
          });
        }),
    );

    const loader = new Loader(platform);
    const loadPromise = loader.loadAll(
      {
        a: imageAsset('/a.png'),
        b: imageAsset('/b.png'),
        c: imageAsset('/c.png'),
        d: imageAsset('/d.png'),
      },
      { concurrency: 2 },
    );

    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png']);
    });
    expect(maxActiveLoads).toBe(2);

    pendingResolves.shift()?.();
    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png']);
    });

    pendingResolves.shift()?.();
    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png', '/d.png']);
    });

    pendingResolves.splice(0).forEach((resolve) => resolve());
    await expect(loadPromise).resolves.toMatchObject({
      a: { id: '/a.png' },
      b: { id: '/b.png' },
      c: { id: '/c.png' },
      d: { id: '/d.png' },
    });
    expect(maxActiveLoads).toBe(2);
  });

  it('uses a default concurrency of 5', async () => {
    const { platform } = createMockPlatform();
    const pendingResolves: Array<() => void> = [];
    const started: string[] = [];
    let activeLoads = 0;
    let maxActiveLoads = 0;

    platform.loadAsset = vi.fn(
      (spec: AssetSpec) =>
        new Promise<ImageAsset>((resolve) => {
          started.push(spec.src);
          activeLoads += 1;
          maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
          pendingResolves.push(() => {
            activeLoads -= 1;
            resolve(createImageAsset(spec.src));
          });
        }),
    );

    const loader = new Loader(platform);
    const loadPromise = loader.loadAll({
      a: imageAsset('/a.png'),
      b: imageAsset('/b.png'),
      c: imageAsset('/c.png'),
      d: imageAsset('/d.png'),
      e: imageAsset('/e.png'),
      f: imageAsset('/f.png'),
    });

    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png', '/d.png', '/e.png']);
    });
    expect(maxActiveLoads).toBe(5);

    pendingResolves.shift()?.();
    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png', '/d.png', '/e.png', '/f.png']);
    });

    pendingResolves.splice(0).forEach((resolve) => resolve());
    await expect(loadPromise).resolves.toMatchObject({
      a: { id: '/a.png' },
      b: { id: '/b.png' },
      c: { id: '/c.png' },
      d: { id: '/d.png' },
      e: { id: '/e.png' },
      f: { id: '/f.png' },
    });
    expect(maxActiveLoads).toBe(5);
  });
});

describe('Loader tryLoadAll', () => {
  it('returns per-key settled results', async () => {
    const { platform } = createMockPlatform();
    const dog = createImageAsset('dog');
    platform.loadAsset = vi.fn(async (spec) => {
      if (spec.src === '/dog.png') {
        return dog;
      }
      throw new Error('missing asset');
    });
    const loader = new Loader(platform);

    const assets = await loader.tryLoadAll({
      dog: imageAsset('/dog.png'),
      bgm: audioAsset('/bgm.mp3'),
    });

    expect(assets.dog).toEqual({ ok: true, value: dog });
    expect(assets.bgm.ok).toBe(false);
    expect(assets.bgm).toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: 'missing asset' }),
    });
    expect(loader.get('dog')).toBe(dog);
    expect(loader.get('bgm')).toBeUndefined();
  });

  it('preserves per-key settled result types', async () => {
    const { platform } = createMockPlatform();
    const loader = new Loader(platform);

    const assets = await loader.tryLoadAll({
      dog: imageAsset('/dog.png'),
      bgm: audioAsset('/bgm.mp3'),
    });

    if (assets.dog.ok) {
      const dog: ImageAsset = assets.dog.value;
      expect(dog.type).toBe('image');
    }

    if (assets.bgm.ok) {
      const bgm: AudioAsset = assets.bgm.value;
      expect(bgm.type).toBe('audio');
    }
  });

  it('reports failed progress and continues loading remaining assets', async () => {
    const { platform } = createMockPlatform();
    const snapshots: Array<{
      progress: { total: number; completed: number; failed: number; pending: number };
      currentAsset?: { key: string; type: string; src: string };
    }> = [];
    platform.loadAsset = vi.fn(async (spec) => {
      if (spec.src === '/cat.png') {
        throw new Error('cat failed');
      }
      return createImageAsset(spec.src);
    });
    const loader = new Loader(platform);

    const result = await loader.tryLoadAll(
      {
        dog: imageAsset('/dog.png'),
        cat: imageAsset('/cat.png'),
        bird: imageAsset('/bird.png'),
      },
      {
        onProgress: (snapshot) => {
          snapshots.push({
            progress: { ...snapshot.progress },
            currentAsset: snapshot.currentAsset ? { ...snapshot.currentAsset } : undefined,
          });
        },
      },
    );

    expect(result.dog).toEqual({ ok: true, value: expect.objectContaining({ id: '/dog.png' }) });
    expect(result.cat).toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: 'cat failed' }),
    });
    expect(result.bird).toEqual({ ok: true, value: expect.objectContaining({ id: '/bird.png' }) });
    expect(snapshots[0]).toEqual({
      progress: { total: 3, completed: 0, failed: 0, pending: 3 },
      currentAsset: undefined,
    });
    expect(snapshots).toContainEqual({
      progress: { total: 3, completed: 1, failed: 1, pending: 1 },
      currentAsset: { key: 'cat', type: 'image', src: '/cat.png' },
    });
    expect(snapshots.at(-1)).toEqual({
      progress: { total: 3, completed: 2, failed: 1, pending: 0 },
      currentAsset: { key: 'bird', type: 'image', src: '/bird.png' },
    });
  });

  it('respects concurrency while settling all assets', async () => {
    const { platform } = createMockPlatform();
    const pending: Array<() => void> = [];
    const started: string[] = [];
    let activeLoads = 0;
    let maxActiveLoads = 0;

    platform.loadAsset = vi.fn(
      (spec: AssetSpec) =>
        new Promise<ImageAsset>((resolve, reject) => {
          started.push(spec.src);
          activeLoads += 1;
          maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
          pending.push(() => {
            activeLoads -= 1;
            if (spec.src === '/b.png') {
              reject(new Error('b failed'));
              return;
            }
            resolve(createImageAsset(spec.src));
          });
        }),
    );

    const loader = new Loader(platform);
    const loadPromise = loader.tryLoadAll(
      {
        a: imageAsset('/a.png'),
        b: imageAsset('/b.png'),
        c: imageAsset('/c.png'),
        d: imageAsset('/d.png'),
      },
      { concurrency: 2 },
    );

    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png']);
    });
    expect(maxActiveLoads).toBe(2);

    pending.shift()?.();
    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png']);
    });

    pending.shift()?.();
    await vi.waitFor(() => {
      expect(started).toEqual(['/a.png', '/b.png', '/c.png', '/d.png']);
    });

    pending.splice(0).forEach((resolve) => resolve());
    const result = await loadPromise;

    expect(result.a).toEqual({ ok: true, value: expect.objectContaining({ id: '/a.png' }) });
    expect(result.b).toMatchObject({
      ok: false,
      error: expect.objectContaining({ message: 'b failed' }),
    });
    expect(result.c).toEqual({ ok: true, value: expect.objectContaining({ id: '/c.png' }) });
    expect(result.d).toEqual({ ok: true, value: expect.objectContaining({ id: '/d.png' }) });
    expect(maxActiveLoads).toBe(2);
  });
});
