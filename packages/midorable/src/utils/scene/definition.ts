import { type DisplayObjectProps, DisplayObject } from '../../core';
import type { ResolvedSceneAssets, SceneAssetMap, SceneAssetsDefinition } from './assets';
import type { SceneNavigator } from './navigator';
import type { SceneRouteMap } from './types';

/**
 * SceneDefinition.create に渡される引数
 */
export interface SceneCreateProps<
  TRoutes extends SceneRouteMap,
  TKey extends keyof TRoutes,
  TAssets extends SceneAssetMap = {},
> {
  context: DisplayObjectProps['context'];
  sceneKey: TKey;
  params: TRoutes[TKey];
  assets: ResolvedSceneAssets<TAssets>;
  navigator: SceneNavigator<TRoutes>;
}

/**
 * SceneDefinition.create から返せるシーン表示単位
 *
 * @remarks
 * 単純なシーンでは DisplayObject をそのまま返せる。
 * 表示オブジェクトとは別に破棄処理が必要な場合は `view` と `dispose` を返す。
 */
export type SceneCreateResult = DisplayObject | SceneView;

/**
 * 表示ルートと任意の破棄処理をまとめたシーン表示単位
 */
export interface SceneView {
  view: DisplayObject;
  dispose?: () => void | Promise<void>;
}

/**
 * 1つのシーンの定義
 *
 * @remarks
 * `getAssets` でシーン遷移前に必要なアセットを定義し、
 * `create` でシーンの表示ルートを生成する。
 */
export interface SceneDefinition<
  TRoutes extends SceneRouteMap,
  TKey extends keyof TRoutes,
  TAssets extends SceneAssetMap = {},
> {
  meta?: Record<string, unknown>;
  getAssets?: SceneAssetsDefinition<TRoutes, TKey, TAssets>;
  create: (props: SceneCreateProps<TRoutes, TKey, TAssets>) => SceneCreateResult | Promise<SceneCreateResult>;
}

/**
 * ルートキーごとのシーン定義マップ
 */
export type SceneDefinitions<TRoutes extends SceneRouteMap> = {
  [TKey in keyof TRoutes]: SceneDefinition<TRoutes, TKey, any>;
};
