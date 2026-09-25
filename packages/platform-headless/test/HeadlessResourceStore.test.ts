import { describe, expect, it, vi } from 'vitest';
import { HeadlessResourceStore } from '../src/HeadlessResourceStore';

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

    fetchMock.mockImplementation(async () => 'new');
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
  const fetchMock = vi.fn((_url: string, _options?: { signal?: AbortSignal }) => backend.promise);
  return { store: new HeadlessResourceStore({ fetchText: fetchMock }), backend, fetchMock };
}
