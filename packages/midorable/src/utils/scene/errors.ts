import type { SceneAssetLoadingProgress } from './types';

/**
 * シーン遷移時のアセット読み込み失敗を表すエラー
 *
 * @remarks
 * `cause` には個別アセット読み込みの元エラーが格納される。
 */
export class SceneAssetLoadingError extends Error {
  readonly progress: SceneAssetLoadingProgress;

  constructor(message: string, options: { progress: SceneAssetLoadingProgress; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'SceneAssetLoadingError';
    this.progress = options.progress;
  }
}
