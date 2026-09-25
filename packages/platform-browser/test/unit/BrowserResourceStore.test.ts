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

  it('aborts the backend when its only consumer cancels', async () => {
    const store = new BrowserResourceStore();
    const fetchMock = vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const pending = store.loadText('/signal.txt', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
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

describe('shared resource cancellation', () => {
  it('keeps a shared load alive when the initiating consumer cancels', async () => {
    const { store, backend, fetchMock } = createStore();
    const controller = new AbortController();
    const first = store.loadText('/shared.txt', controller.signal);
    const second = store.loadText('/shared.txt');
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    backend.resolve('shared');
    const asset = await second;
    expect(asset.content).toBe('shared');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    store.unload(asset);
    await store.loadText('/shared.txt');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['success', 'failure'])('isolates a replacement from a cancelled load ending in %s', async (outcome) => {
    const { store, backend, fetchMock } = createStore();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = store.loadText('/shared.txt', firstController.signal);
    const second = store.loadText('/shared.txt', secondController.signal);
    firstController.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const finished = vi.fn();
    const observed = second.then(finished, finished);
    secondController.abort();
    expect(fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();

    fetchMock.mockImplementation(async () => ({ ok: true, text: async () => 'new' }));
    const replacement = await store.loadText('/shared.txt');
    if (outcome === 'success') {
      backend.resolve('old');
      const late = await second;
      expect(late.content).toBe('old');
      store.unload(late);
    } else {
      backend.reject(new Error('old load failed'));
      await expect(second).rejects.toThrow('old load failed');
    }
    await observed;
    const cached = await store.loadText('/shared.txt');
    expect(cached.content).toBe('new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    store.unload(replacement);
    store.unload(cached);
    await store.loadText('/shared.txt');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function createStore() {
  const backend = Promise.withResolvers<string>();
  const fetchMock = vi.fn(async (_url: string, _options?: { signal?: AbortSignal }) => ({
    ok: true,
    text: () => backend.promise,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return { store: new BrowserResourceStore(), backend, fetchMock };
}
