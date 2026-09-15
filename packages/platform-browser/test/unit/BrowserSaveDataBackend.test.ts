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
      saveData = new BrowserSaveDataBackend({ namespace: 'test-game' });
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
    const saveData = new BrowserSaveDataBackend({ namespace: 'test-game' });

    await saveData.save('foo');
    await saveData.save('bar');

    await expect(new BrowserSaveDataBackend({ namespace: 'test-game' }).load()).resolves.toBe('bar');
    expect(data.get('test-game')).toBe('bar');
    expect(data.size).toBe(2);
    expect(data.get('other-game-data')).toBe('untouched');
  });

  it('isolates games sharing localStorage', async () => {
    stubLocalStorage();
    const firstGame = new BrowserSaveDataBackend({ namespace: 'first-game' });
    const secondGame = new BrowserSaveDataBackend({ namespace: 'second-game' });

    await firstGame.save('first progress');
    await expect(secondGame.load()).resolves.toBe('');
    await secondGame.save('second progress');
    await expect(firstGame.load()).resolves.toBe('first progress');
    await firstGame.save('updated progress');
    await expect(secondGame.load()).resolves.toBe('second progress');
  });

  it('does not read or overwrite the legacy shared key', async () => {
    const data = stubLocalStorage();
    data.set('midorable.saveData', 'legacy progress');
    const saveData = new BrowserSaveDataBackend({ namespace: 'test-game' });

    await expect(saveData.load()).resolves.toBe('');
    await saveData.save('new progress');
    expect(data.get('midorable.saveData')).toBe('legacy progress');
  });

  it.each(['', ' ', '\t\n'])('rejects an empty or whitespace-only namespace: %j', (namespace) => {
    expect(() => new BrowserSaveDataBackend({ namespace })).toThrow(
      'Save data namespace must not be empty or whitespace-only',
    );
  });
});
