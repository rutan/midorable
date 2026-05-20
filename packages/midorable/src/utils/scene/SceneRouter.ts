import { createEventHandlers, type AppContext, type DisplayObject } from '../../core';
import type { EventHandlers } from '../../core/events';
import type { SceneAssetMap, SceneAssetsDefinition } from './assets';
import type { SceneDefinition, SceneDefinitions } from './definition';
import { SceneRuntime } from './internal';
import type { SceneChangeEvent, SceneLoadingState, SceneNavigationArgs, SceneRouteMap } from './types';

export interface SceneRouterSetupConfig<TRoutes extends SceneRouteMap> {
  root: DisplayObject;
  context: AppContext;
  routes: SceneDefinitions<TRoutes>;
}

/**
 * シーン定義と実行時の遷移インターフェースをまとめるルーター
 *
 * @remarks
 * SceneRouter は SceneMap を固定したうえで、シーン定義を型安全に作るためのファサード。
 * 実際の遷移、読み込み、破棄は内部ランタイムが担当する。
 */
export class SceneRouter<TRoutes extends SceneRouteMap> {
  private _runtime: SceneRuntime<TRoutes> | null = null;
  private _onSceneChanged = createEventHandlers<SceneChangeEvent<TRoutes>>();
  private _onLoadingStateChanged = createEventHandlers<SceneLoadingState<TRoutes>>();

  defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    sceneKey: TKey,
    assets: TAssets,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets>;
  defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    sceneKey: TKey,
    assets: SceneAssetsDefinition<TRoutes, TKey, TAssets>,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets>;
  defineAssets<TKey extends keyof TRoutes, TAssets extends SceneAssetMap>(
    _sceneKey: TKey,
    assets: TAssets | SceneAssetsDefinition<TRoutes, TKey, TAssets>,
  ): SceneAssetsDefinition<TRoutes, TKey, TAssets> {
    if (typeof assets === 'function') {
      return assets;
    }
    return () => assets;
  }

  defineScene<TKey extends keyof TRoutes, TAssets extends SceneAssetMap = {}>(
    _sceneKey: TKey,
    definition: SceneDefinition<TRoutes, TKey, TAssets>,
  ): SceneDefinition<TRoutes, TKey, TAssets> {
    return definition;
  }

  setup(config: SceneRouterSetupConfig<TRoutes>): void {
    if (this._runtime) {
      throw new Error('SceneRouter is already set up');
    }
    this._runtime = new SceneRuntime({
      root: config.root,
      context: config.context,
      routes: config.routes,
    });
    this._runtime.onSceneChanged.on((event) => {
      this._onSceneChanged.emit(event);
    });
    this._runtime.onLoadingStateChanged.on((state) => {
      this._onLoadingStateChanged.emit(state);
    });
  }

  get currentView(): DisplayObject | null {
    return this.ensureRuntime().currentView;
  }

  get currentRoute() {
    return this.ensureRuntime().currentRoute;
  }

  get onSceneChanged(): EventHandlers<SceneChangeEvent<TRoutes>>['listeners'] {
    return this._onSceneChanged.listeners;
  }

  get onLoadingStateChanged(): EventHandlers<SceneLoadingState<TRoutes>>['listeners'] {
    return this._onLoadingStateChanged.listeners;
  }

  goTo<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    return this.ensureRuntime().goTo(...(args as any));
  }

  pushScene<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    return this.ensureRuntime().pushScene(...(args as any));
  }

  popScene() {
    return this.ensureRuntime().popScene();
  }

  private ensureRuntime(): SceneRuntime<TRoutes> {
    if (!this._runtime) {
      throw new Error('SceneRouter is not set up');
    }
    return this._runtime;
  }
}

export function createSceneRouter<TRoutes extends SceneRouteMap>() {
  return new SceneRouter<TRoutes>();
}
