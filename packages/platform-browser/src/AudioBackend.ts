import { AudioAsset, AudioBackend, AudioInstance, PlaybackUpdateOptions, PlayOptions } from '@rutan/midorable';

interface AudioInstancePayload {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode | null;
}

export class BrowserAudioBackend implements AudioBackend {
  private _context: AudioContext;
  private _master: GainNode;
  private _masterVolume = 1;
  private _muted = false;
  private _nextId = 1;
  private _unlockElement: HTMLElement | null;
  private _unlockHandler: (() => void) | null = null;

  constructor(config?: { context?: AudioContext; element?: HTMLElement }) {
    this._context = config?.context ?? new AudioContext();
    this._master = this._context.createGain();
    this._master.connect(this._context.destination);
    this.updateMaster();
    this._unlockElement = config?.element ?? null;
    this.attachUnlockHandlers();
  }

  async loadAudio(url: string, signal?: AbortSignal): Promise<AudioAsset> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load audio asset: ${url} (${response.status} ${response.statusText})`);
    }
    const data = await response.arrayBuffer();
    const buffer = await this._context.decodeAudioData(data);
    return { id: url, type: 'audio', duration: buffer.duration, source: buffer };
  }

  play(asset: AudioAsset, options?: PlayOptions): AudioInstance {
    void this.resume();

    const buffer = asset.source;
    if (!(buffer instanceof AudioBuffer)) {
      throw new Error('Unsupported audio source for browser platform');
    }

    const source = this._context.createBufferSource();
    source.buffer = buffer;
    if (options?.loop !== undefined) {
      source.loop = options.loop;
    }
    if (options?.rate !== undefined) {
      source.playbackRate.value = options.rate;
    }

    let node: AudioNode = source;
    const gain = this._context.createGain();
    gain.gain.value = options?.volume ?? 1;
    node.connect(gain);
    node = gain;

    let panner: StereoPannerNode | null = null;
    if (typeof this._context.createStereoPanner === 'function') {
      panner = this._context.createStereoPanner();
      panner.pan.value = options?.pan ?? 0;
      node.connect(panner);
      node = panner;
    }

    node.connect(this._master);
    source.start(0);

    const instance: AudioInstance = {
      id: this._nextId,
      source: { source, gain, panner } satisfies AudioInstancePayload,
    };
    this._nextId += 1;

    source.onended = () => {
      source.disconnect();
      gain?.disconnect();
      panner?.disconnect();
    };

    return instance;
  }

  stop(instance: AudioInstance) {
    const payload = this.getPayload(instance);
    if (!payload) {
      return;
    }
    try {
      payload.source.stop();
    } catch {
      // noop
    }
  }

  updatePlayback(instance: AudioInstance, options: PlaybackUpdateOptions) {
    const payload = this.getPayload(instance);
    if (!payload) {
      return;
    }
    if (options.volume !== undefined) {
      payload.gain.gain.value = options.volume;
    }
    if (options.rate !== undefined) {
      payload.source.playbackRate.value = options.rate;
    }
    if (options.pan !== undefined && payload.panner) {
      payload.panner.pan.value = options.pan;
    }
  }

  setMasterVolume(volume: number) {
    this._masterVolume = volume;
    this.updateMaster();
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    this.updateMaster();
  }

  async resume() {
    if (this._context.state === 'suspended') {
      await this._context.resume();
    }
  }

  dispose() {
    this.detachUnlockHandlers();
    this._master.disconnect();
    void this._context.close();
  }

  private updateMaster() {
    this._master.gain.value = this._muted ? 0 : this._masterVolume;
  }

  private attachUnlockHandlers() {
    if (!this._unlockElement || this._unlockHandler) {
      return;
    }

    const unlock = () => {
      void this.resume();
      this.detachUnlockHandlers();
    };

    this._unlockHandler = unlock;
    this._unlockElement.addEventListener('pointerdown', unlock, { passive: true });
    this._unlockElement.addEventListener('touchstart', unlock, { passive: true });
    this._unlockElement.addEventListener('keydown', unlock);
  }

  private detachUnlockHandlers() {
    if (!this._unlockElement || !this._unlockHandler) {
      return;
    }

    const unlock = this._unlockHandler;
    this._unlockElement.removeEventListener('pointerdown', unlock);
    this._unlockElement.removeEventListener('touchstart', unlock);
    this._unlockElement.removeEventListener('keydown', unlock);
    this._unlockHandler = null;
  }

  private getPayload(instance: AudioInstance): AudioInstancePayload | null {
    const payload = instance.source;
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const candidate = payload as AudioInstancePayload;
    if (!(candidate.source instanceof AudioBufferSourceNode)) {
      return null;
    }

    return candidate;
  }
}
