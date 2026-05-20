import { AudioAsset, AudioBackend, AudioInstance, PlaybackUpdateOptions, PlayOptions } from '@rutan/midorable';

export class HeadlessAudioBackend implements AudioBackend {
  private _nextId = 1;
  private _masterVolume = 1;
  private _muted = false;

  play(_audioAsset: AudioAsset, _options?: PlayOptions): AudioInstance {
    const instance: AudioInstance = {
      id: this._nextId,
      source: null,
    };
    this._nextId += 1;
    return instance;
  }

  stop(_instance: AudioInstance): void {
    // noop
  }

  updatePlayback(_instance: AudioInstance, _options: PlaybackUpdateOptions): void {
    // noop
  }

  setMasterVolume(volume: number): void {
    this._masterVolume = volume;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  async resume(): Promise<void> {
    // noop
  }

  dispose(): void {
    this._nextId = 1;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  get muted(): boolean {
    return this._muted;
  }
}
