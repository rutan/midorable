import type { SystemSaveDataFeature } from '@rutan/midorable/platform';
import { BrowserPlatformBase } from '../BrowserPlatformBase';

export interface BrowserSaveDataOptions {
  /** 保存先の名前空間 */
  namespace: string;
}

export function registerSaveDataFeature(platform: BrowserPlatformBase, options: BrowserSaveDataOptions) {
  platform.setFeature('system.saveData', new BrowserSaveDataBackend(options));
}

export class BrowserSaveDataBackend implements SystemSaveDataFeature {
  private readonly _namespace: string;
  private _storage: Storage | undefined;
  private _memoryData = '';

  constructor(options: BrowserSaveDataOptions) {
    if (!options.namespace.trim()) {
      throw new Error('Save data namespace must not be empty or whitespace-only');
    }
    this._namespace = options.namespace;
    this._storage = this.resolveStorage();
  }

  async load(): Promise<string> {
    return this._storage ? (this._storage.getItem(this._namespace) ?? '') : this._memoryData;
  }

  async save(data: string): Promise<void> {
    if (this._storage) {
      this._storage.setItem(this._namespace, data);
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
