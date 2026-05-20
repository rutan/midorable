import type { AppContext } from '../../core';

/**
 * シーンキーごとのパラメータ型を表すためのマーカーインターフェース
 */
export interface SceneRouteMap {}

/**
 * シーン遷移メソッドに渡す引数型
 *
 * @remarks
 * 遷移先パラメータ型に `undefined` が含まれる場合のみ、第2引数を省略できる。
 */
export type SceneNavigationArgs<
  TRoutes extends SceneRouteMap,
  TKey extends keyof TRoutes,
> = undefined extends TRoutes[TKey]
  ? [sceneKey: TKey, params?: TRoutes[TKey]]
  : [sceneKey: TKey, params: TRoutes[TKey]];

/**
 * シーン変更完了時に通知されるイベント
 */
export interface SceneChangeEvent<TRoutes extends SceneRouteMap> {
  sceneKey: keyof TRoutes;
  params: TRoutes[keyof TRoutes] | undefined;
  meta: Record<string, unknown>;
}

/**
 * シーン用アセット定義関数に渡される引数
 */
export interface SceneAssetsContext<TRoutes extends SceneRouteMap, TKey extends keyof TRoutes> {
  context: AppContext;
  sceneKey: TKey;
  params: TRoutes[TKey];
}

/**
 * 現在ロード中のアセット1件を表す情報
 */
export interface SceneAssetLoadingEntry {
  key: string;
  type: 'image' | 'audio' | 'text' | 'binary';
  src: string;
}

/**
 * シーンアセット読み込みの進行状況
 */
export interface SceneAssetLoadingProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

/**
 * シーンアセット読み込み状態のスナップショット
 */
export interface SceneAssetLoadingSnapshot {
  progress: SceneAssetLoadingProgress;
}

/**
 * ローディング表示が非表示の状態
 */
export interface HiddenSceneLoadingState {
  status: 'hidden';
}

/**
 * シーン読み込み中の状態
 */
export interface SceneAssetLoadingState<TRoutes extends SceneRouteMap> {
  status: 'loading';
  sceneKey: keyof TRoutes;
  params: TRoutes[keyof TRoutes] | undefined;
  assetLoading: SceneAssetLoadingSnapshot | null;
}

/**
 * シーン読み込み失敗時の状態
 *
 * @remarks
 * `retry()` を呼ぶと、失敗した遷移先に対して同じ引数で再試行する。
 */
export interface FailedSceneLoadingState<TRoutes extends SceneRouteMap> {
  status: 'failed';
  sceneKey: keyof TRoutes;
  params: TRoutes[keyof TRoutes] | undefined;
  assetLoading: SceneAssetLoadingSnapshot | null;
  error: unknown;
  retry: () => Promise<void>;
}

/**
 * ロード画面などへ通知されるシーン読み込み状態
 */
export type SceneLoadingState<TRoutes extends SceneRouteMap> =
  | HiddenSceneLoadingState
  | SceneAssetLoadingState<TRoutes>
  | FailedSceneLoadingState<TRoutes>;
