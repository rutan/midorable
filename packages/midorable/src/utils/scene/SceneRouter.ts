import type { AppContext, DisplayObject } from '../../engine';
import type { SceneDefinitions } from './definition';
import { SceneRuntime } from './internal';
import type { SceneNavigator } from './navigator';
import type { SceneNavigationArgs, SceneRouteMap } from './types';

export interface SceneRouterConfig<TRoutes extends SceneRouteMap> {
  root: DisplayObject;
  context: AppContext;
  routes: SceneDefinitions<TRoutes>;
}

/**
 * アプリケーションごとのシーン表示・遷移・ライフサイクルを管理するルーター。
 */
export class SceneRouter<TRoutes extends SceneRouteMap> implements SceneNavigator<TRoutes> {
  private readonly _runtime: SceneRuntime<TRoutes>;

  constructor(config: SceneRouterConfig<TRoutes>) {
    this._runtime = new SceneRuntime(config);
  }

  /** 現在表示中のシーンビュー。未表示または破棄後は null。 */
  get currentView() {
    return this._runtime.currentView;
  }

  /** 現在表示中のシーンのルート情報。未表示または破棄後は null。 */
  get currentRoute() {
    return this._runtime.currentRoute;
  }

  /** シーン遷移完了時のイベントリスナー。 */
  get onSceneChanged() {
    return this._runtime.onSceneChanged;
  }

  /** シーン読み込み状態のイベントリスナー。 */
  get onLoadingStateChanged() {
    return this._runtime.onLoadingStateChanged;
  }

  goTo<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    return this._runtime.goTo<TKey>(...args);
  }

  pushScene<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    return this._runtime.pushScene<TKey>(...args);
  }

  popScene() {
    return this._runtime.popScene();
  }

  /**
   * 受け付け済みの遷移を待ち、現在・退避中のシーンとイベント購読を破棄する。
   *
   * @remarks
   * 呼び出し後の遷移要求は拒否される。複数回呼んでも破棄は一度だけ行う。
   * root やアプリケーション共通の loader は破棄しない。App.dispose() より先に呼ぶ。
   */
  dispose(): Promise<void> {
    return this._runtime.dispose();
  }
}

/** シーン定義と実行環境から、アプリケーション専用のルーターを作成する。 */
export function createSceneRouter<TRoutes extends SceneRouteMap>(config: SceneRouterConfig<TRoutes>) {
  return new SceneRouter<TRoutes>(config);
}
