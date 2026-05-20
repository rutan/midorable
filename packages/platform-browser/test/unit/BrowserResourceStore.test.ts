import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserResourceStore } from '../../src/BrowserResourceStore';

describe('BrowserResourceStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects text loads on HTTP error and allows retry', async () => {
    const store = new BrowserResourceStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'ok',
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(store.loadText('/missing.txt')).rejects.toThrow('Failed to load text asset');
    await expect(store.loadText('/missing.txt')).resolves.toMatchObject({ content: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects binary loads on HTTP error and allows retry', async () => {
    const store = new BrowserResourceStore();
    const buffer = new ArrayBuffer(4);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => buffer,
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(store.loadBinary('/data.bin')).rejects.toThrow('Failed to load binary asset');
    await expect(store.loadBinary('/data.bin')).resolves.toMatchObject({ content: buffer });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns distinct asset instances while retaining cached content until all references are unloaded', async () => {
    const store = new BrowserResourceStore();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', fetchMock);

    const text1 = await store.loadText('/shared.txt');
    const text2 = await store.loadText('/shared.txt');

    expect(text1).not.toBe(text2);
    expect(text1.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    store.unload(text1);
    const text3 = await store.loadText('/shared.txt');
    expect(text3).not.toBe(text2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    store.unload(text2);
    store.unload(text3);
    await store.loadText('/shared.txt');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes AbortSignal to fetch for text loads', async () => {
    const store = new BrowserResourceStore();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await store.loadText('/signal.txt', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith('/signal.txt', { signal: controller.signal });
  });

  it('rejects an aborted cached consumer without retaining its reference', async () => {
    const store = new BrowserResourceStore();
    let resolveText!: (value: string) => void;
    const textPromise = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => textPromise,
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstLoad = store.loadText('/shared-pending.txt');
    const controller = new AbortController();
    const secondLoad = store.loadText('/shared-pending.txt', controller.signal);

    controller.abort();
    await expect(secondLoad).rejects.toMatchObject({ name: 'AbortError' });

    resolveText('ok');
    const firstAsset = await firstLoad;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    store.unload(firstAsset);
    await store.loadText('/shared-pending.txt');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
