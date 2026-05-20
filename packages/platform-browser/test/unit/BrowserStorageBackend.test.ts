import { afterEach, describe, expect, it } from 'vitest';
import { BrowserStorageBackend } from '../../src/features/storage';

describe('BrowserStorageBackend', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('falls back to memory storage when localStorage access throws', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage unavailable');
      },
    });

    const storage = new BrowserStorageBackend();
    await storage.setItem('key', 'value');

    await expect(storage.getItem('key')).resolves.toBe('value');
  });
});
