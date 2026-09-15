import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSaveDataBackend } from '../../src/features/saveData';

function stubLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  return data;
}

describe('BrowserSaveDataBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe.each([
    { name: 'localStorage', setup: stubLocalStorage },
    {
      name: 'memory fallback when localStorage is absent',
      setup() {
        vi.stubGlobal('localStorage', undefined);
        delete (globalThis as { localStorage?: Storage }).localStorage;
      },
    },
    {
      name: 'memory fallback when localStorage is undefined',
      setup() {
        vi.stubGlobal('localStorage', undefined);
      },
    },
    {
      name: 'memory fallback when localStorage access throws',
      setup() {
        vi.stubGlobal('localStorage', undefined);
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          get() {
            throw new Error('localStorage unavailable');
          },
        });
      },
    },
  ])('$name', (scenario) => {
    let saveData: BrowserSaveDataBackend;

    beforeEach(() => {
      scenario.setup();
      saveData = new BrowserSaveDataBackend();
    });

    it('loads an empty string before saving', async () => {
      await expect(saveData.load()).resolves.toBe('');
    });

    it('loads the saved string', async () => {
      await saveData.save('foo');
      await expect(saveData.load()).resolves.toBe('foo');
    });

    it('replaces the previous data with the last saved string', async () => {
      await saveData.save('foo');
      await saveData.save('bar');
      await expect(saveData.load()).resolves.toBe('bar');
    });

    it('can overwrite saved data with an empty string', async () => {
      await saveData.save('foo');
      await saveData.save('');
      await expect(saveData.load()).resolves.toBe('');
    });
  });

  it('persists data across instances in one localStorage slot without changing other data', async () => {
    const data = stubLocalStorage();
    data.set('other-game-data', 'untouched');
    const saveData = new BrowserSaveDataBackend();

    await saveData.save('foo');
    await saveData.save('bar');

    await expect(new BrowserSaveDataBackend().load()).resolves.toBe('bar');
    expect(data.size).toBe(2);
    expect(data.get('other-game-data')).toBe('untouched');
  });
});
