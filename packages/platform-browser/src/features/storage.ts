import type { SystemStorageFeature } from '@rutan/midorable';
import { BrowserPlatformBase } from '../BrowserPlatformBase';

export function registerStorageFeature(platform: BrowserPlatformBase, options: BrowserStorageBackendOptions = {}) {
  platform.setFeature('system.storage', new BrowserStorageBackend(options));
}

export interface BrowserStorageBackendOptions {
  prefix?: string;
}

export class BrowserStorageBackend implements SystemStorageFeature {
  private _prefix: string;
  private _storage: Storage;

  constructor({ prefix }: BrowserStorageBackendOptions = {}) {
    this._prefix = prefix ?? '';
    this._storage = this.resolveStorage();
  }

  async getItem(key: string): Promise<string | null> {
    const prefixedKey = `${this._prefix}${key}`;
    return this._storage.getItem(prefixedKey);
  }

  async setItem(key: string, value: string): Promise<void> {
    const prefixedKey = `${this._prefix}${key}`;
    this._storage.setItem(prefixedKey, value);
  }

  async removeItem(key: string): Promise<void> {
    const prefixedKey = `${this._prefix}${key}`;
    this._storage.removeItem(prefixedKey);
  }

  async clear(): Promise<void> {
    if (this._prefix) {
      for (let i = this._storage.length - 1; i >= 0; i--) {
        const key = this._storage.key(i);
        if (key && key.startsWith(this._prefix)) {
          this._storage.removeItem(key);
        }
      }
    } else {
      this._storage.clear();
    }
  }

  private resolveStorage(): Storage {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return new MemoryStorage();
    }

    try {
      return globalThis.localStorage;
    } catch {
      return new MemoryStorage();
    }
  }
}

class MemoryStorage implements Storage {
  private _store: Map<string, string> = new Map();

  get length(): number {
    return this._store.size;
  }

  clear(): void {
    this._store.clear();
  }

  getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this._store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }
}
