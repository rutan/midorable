import type { AssetSpec, AudioAsset, BinaryAsset, ImageAsset, TextAsset } from '../../core';
import type { SceneAssetsContext, SceneRouteMap } from './types';

/**
 * シーンアセット種別ごとの解決後型マップ
 */
export interface SceneAssetTypeMap {
  image: ImageAsset;
  audio: AudioAsset;
  text: TextAsset;
  binary: BinaryAsset;
}

/**
 * シーンで使用するアセット定義マップ
 */
export type SceneAssetMap = Record<string, AssetSpec>;

/**
 * 個別アセット定義から解決後アセット型を取得するユーティリティ型
 */
export type ResolvedSceneAsset<TAsset extends AssetSpec> = SceneAssetTypeMap[TAsset['type']];

/**
 * アセット定義マップから解決後アセットマップを取得するユーティリティ型
 */
export type ResolvedSceneAssets<TAssets extends SceneAssetMap> = {
  [TKey in keyof TAssets]: ResolvedSceneAsset<TAssets[TKey]>;
};

/**
 * defineAssets などで宣言した関数から解決後アセット型を取り出すユーティリティ型
 */
export type AssetsOf<TAssetsDefinition> = TAssetsDefinition extends (...args: any[]) => infer TResult
  ? Awaited<TResult> extends SceneAssetMap
    ? ResolvedSceneAssets<Awaited<TResult>>
    : never
  : never;

/**
 * シーン遷移前に必要なアセット定義を返す関数
 *
 * @remarks
 * SceneRouter はこの関数の結果をもとにアセットをロードし、
 * 解決済みアセットを `SceneDefinition.create` に渡す。
 */
export type SceneAssetsDefinition<
  TRoutes extends SceneRouteMap,
  TKey extends keyof TRoutes,
  TAssets extends SceneAssetMap = SceneAssetMap,
> = (props: SceneAssetsContext<TRoutes, TKey>) => TAssets | Promise<TAssets>;
