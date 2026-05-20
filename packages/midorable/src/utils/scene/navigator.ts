import type { SceneNavigationArgs, SceneRouteMap } from './types';

/**
 * シーン遷移を行うためのインターフェース
 *
 * @remarks
 * 各シーンビューの生成時に `navigator` として渡される。
 * 実際の遷移処理は SceneRouter が担当する。
 */
export interface SceneNavigator<TRoutes extends SceneRouteMap> {
  /**
   * 現在のシーンを破棄して、指定したシーンへ遷移する
   * @param args - 遷移先のシーンキーとパラメータ
   */
  goTo<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>): Promise<void>;
  /**
   * 現在のシーンをスタックに退避し、指定したシーンへ遷移する
   * @param args - 遷移先のシーンキーとパラメータ
   */
  pushScene<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>): Promise<void>;
  /**
   * スタックに退避していた直前のシーンへ戻る
   */
  popScene(): Promise<void>;
}
