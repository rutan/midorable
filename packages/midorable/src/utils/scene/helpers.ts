import type { SceneAssetMap, SceneAssetsDefinition } from './assets';
import type { SceneDefinition } from './definition';
import type { SceneRouteMap } from './types';

/**
 * シーンキーとパラメータ型を固定した定義用ヘルパーを作成する。
 *
 * @remarks
 * 定義やアプリケーションの状態は保持しないため、モジュール単位で共有できる。
 */
export function createSceneHelpers<TRoutes extends SceneRouteMap>() {
  function defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    sceneKey: TKey,
    assets: TAssets,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets>;
  function defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    sceneKey: TKey,
    assets: SceneAssetsDefinition<TRoutes, TKey, TAssets>,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets>;
  function defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    _sceneKey: TKey,
    assets: TAssets | SceneAssetsDefinition<TRoutes, TKey, TAssets>,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets> {
    if (typeof assets === 'function') {
      return assets;
    }
    return () => assets;
  }

  function defineScene<TKey extends keyof TRoutes, TAssets extends SceneAssetMap = {}>(
    _sceneKey: TKey,
    definition: SceneDefinition<TRoutes, TKey, TAssets>,
  ): SceneDefinition<TRoutes, TKey, TAssets> {
    return definition;
  }

  return { defineScene, defineAssets };
}
