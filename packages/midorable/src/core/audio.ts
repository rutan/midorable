import { AudioAsset } from './asset';

/**
 * 各プラットフォームのオーディオ再生機能のインタフェース
 *
 * @remarks
 * 実際の実装はプラットフォーム側で行われる。
 * Platform が `volume`, `loop`, `rate`, `pan` の一部をサポートしない場合、その option は無視してよい。
 * 停止済みまたは再生完了済みの `AudioInstance` に対する `stop()` は no-op として扱うことが望ましい。
 * `resume()` はユーザー操作後の audio context 再開などに使われる。
 * 再開処理が不要な Platform では resolved Promise を返してよい。
 *
 * アプリケーションの開発者は App の `audio` プロパティを通じてこのインタフェースを利用する。
 */
export interface AudioBackend {
  /**
   * 音声を再生する
   *
   * @remarks
   * Platform が一部の `PlayOptions` をサポートしない場合、その項目は無視してよい。
   *
   * @param audioAsset - 再生する音声クリップ
   * @param options - 再生オプション
   */
  play(audioAsset: AudioAsset, options?: PlayOptions): AudioInstance;

  /**
   * 指定の音声インスタンスの再生パラメータを更新する
   *
   * @remarks
   * Platform が一部の `PlaybackUpdateOptions` をサポートしない場合、その項目は無視してよい。
   *
   * @param instance - 音声インスタンス
   * @param options - 更新パラメータ
   */
  updatePlayback(instance: AudioInstance, options: PlaybackUpdateOptions): void;

  /**
   * 指定の音声を停止する
   *
   * @remarks
   * 停止済みまたは再生完了済みの instance が渡された場合は no-op として扱うことが望ましい。
   *
   * @param instance - 音声インスタンス
   */
  stop(instance: AudioInstance): void;

  /**
   * マスター音量を設定する
   * @param volume - 音量（0.0〜1.0）
   */
  setMasterVolume(volume: number): void;

  /**
   * ミュート状態を設定する
   * @param muted - ミュート状態
   */
  setMuted(muted: boolean): void;

  /**
   * オーディオを再開する
   *
   * @remarks
   * ユーザー操作後の audio context 再開などに使用される。
   * 再開処理が不要な Platform では resolved Promise を返してよい。
   */
  resume(): Promise<void>;

  /**
   * オーディオを破棄する
   */
  dispose(): void;
}

/**
 * 再生中の音声インスタンス
 */
export interface AudioInstance {
  /** 再生インスタンスのID */
  id: number;

  /**
   * 音声のソース
   * 返す値の型はプラットフォーム依存。
   * アプリケーション側に露出不能な場合、プラットフォームは null を返しても良い。
   */
  source: unknown;
}

/**
 * 音声再生のオプション
 *
 * @remarks
 * これらのオプションは、プラットフォームによってサポートされない場合があります。
 */
export interface PlayOptions {
  /** 音量（0.0〜1.0） */
  volume?: number;
  /** 繰り返し再生するか */
  loop?: boolean;
  /** 再生速度 */
  rate?: number;
  /** 位相（-1.0〜1.0） */
  pan?: number;
}

/**
 * 再生中の音声のパラメータを更新するためのオプション
 *
 * @remarks
 * これらのオプションは、プラットフォームによってサポートされない場合があります。
 */
export interface PlaybackUpdateOptions {
  /** 音量（0.0〜1.0） */
  volume?: number;
  /** 再生速度 */
  rate?: number;
  /** 位相（-1.0〜1.0） */
  pan?: number;
}
