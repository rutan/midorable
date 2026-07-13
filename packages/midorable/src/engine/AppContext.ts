import type { App } from './App';
import type { Loader } from './Loader';

/**
 * 各種オブジェクトで共有するコンテキストオブジェクト
 *
 * @remarks
 * 子要素には親要素のコンテキストをそのまま渡すことを想定している。
 * 必要に応じて Loader などを上書きしたコンテキストを渡すこともできる。
 */
export interface AppContext {
  /** App インスタンスへの参照 */
  app: App;
  /** Loader インスタンスへの参照 */
  loader: Loader;
}
