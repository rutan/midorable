import { AssetsBackend } from './assets';
import { AudioBackend } from './audio';
import { PlatformFeatureRegistry } from './features';
import { GraphicsBackend } from './graphics';
import { HostBackend } from './host';
import { InputBackend } from './input';

/**
 * アプリケーションが動作するプラットフォーム機能のインタフェース
 *
 * @remarks
 * Midorable のコア機能を動作させるために必要な機能を定義するインタフェース。
 * このインタフェースを満たす実装を行うことで、Midorable を様々な環境で動作させることができる。
 * 具体的な実装例は `@rutan/midorable-platform-browser` や
 * `@rutan/midorable-platform-headless` の各種プラットフォーム実装を参照。
 * 独自 Platform 実装者は、`host`, `graphics`, `audio`, `input`, `assets` を提供する。
 *
 * Engine は `App` のライフサイクル内でこれらを呼び出すため、`host.stopLoop()` や `assets.unload()` などの
 * 後始末系メソッドは、可能な限り冪等に実装することが望ましい。
 * 必須機能を実装できない環境では、呼び出されても安全な no-op 実装を提供するか、
 * その機能のメソッド内で明示的に reject / throw する。任意機能は `getFeature()` で undefined を返す。
 *
 * ゲーム開発者は原則的にこのインタフェースを直接操作することはなく、 `App` クラス等が提供するインタフェースを通じて利用する。
 */
export interface Platform {
  /** ホスト環境の機能 */
  host: HostBackend;
  /** 画面描画機構 */
  graphics: GraphicsBackend;
  /** オーディオ再生機構 */
  audio: AudioBackend;
  /** 入力機構 */
  input: InputBackend;
  /** アセット管理機構 */
  assets: AssetsBackend;

  /**
   * プラットフォーム側のリソースを解放する
   *
   * @remarks
   * このメソッド呼び出し後、Platform オブジェクトの機能は使用できなくなる
   */
  dispose(): void;

  /**
   * プラットフォーム固有の機能を取得する
   * @param key - 取得したい機能のキー
   * @returns その機能が存在する場合は機能オブジェクトを返し、存在しない場合は undefined を返す
   */
  getFeature<K extends keyof PlatformFeatureRegistry>(key: K): PlatformFeatureRegistry[K] | undefined;
}
