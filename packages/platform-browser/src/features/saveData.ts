import type { SystemSaveDataFeature } from '@rutan/midorable/platform';
import { BrowserPlatformBase } from '../BrowserPlatformBase';

const SAVE_DATA_KEY = 'midorable.saveData';

export function registerSaveDataFeature(platform: BrowserPlatformBase) {
  platform.setFeature('system.saveData', new BrowserSaveDataBackend());
}

export class BrowserSaveDataBackend implements SystemSaveDataFeature {
  private _storage: Storage | undefined;
  private _memoryData = '';

  constructor() {
    this._storage = this.resolveStorage();
  }

  async load(): Promise<string> {
    return this._storage ? (this._storage.getItem(SAVE_DATA_KEY) ?? '') : this._memoryData;
  }

  async save(data: string): Promise<void> {
    if (this._storage) {
      this._storage.setItem(SAVE_DATA_KEY, data);
    } else {
      this._memoryData = data;
    }
  }

  private resolveStorage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }
}
