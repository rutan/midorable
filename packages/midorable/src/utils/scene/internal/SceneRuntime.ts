import { type AppContext, createEventHandlers, DisplayObject, Loader } from '../../../core';
import type { SceneCreateResult, SceneDefinitions, SceneView } from '../definition';
import { SceneAssetLoadingError } from '../errors';
import type { SceneNavigator } from '../navigator';
import type {
  SceneAssetLoadingSnapshot,
  SceneChangeEvent,
  SceneLoadingState,
  SceneNavigationArgs,
  SceneRouteMap,
} from '../types';

/**
 * シーンランタイムの初期化パラメータ
 */
interface SceneRuntimeProps<TRoutes extends SceneRouteMap> {
  root: DisplayObject;
  context: AppContext;
  routes: SceneDefinitions<TRoutes>;
}

interface ManagedScene<TRoutes extends SceneRouteMap> {
  key: keyof TRoutes;
  params: TRoutes[keyof TRoutes] | undefined;
  meta: Record<string, unknown>;
  view: DisplayObject;
  dispose?: () => void | Promise<void>;
  loader: AppContext['loader'];
}

/**
 * SceneRouter の内部でシーンの生成・破棄・遷移を処理するランタイム
 *
 * @remarks
 * `goTo()` による置き換え遷移、`pushScene()` / `popScene()` によるスタック型遷移を提供する。
 * 遷移要求は内部キューで直列化されるため、複数の遷移が連続して呼ばれても順番に処理される。
 *
 * `getAssets` を持つシーンでは、シーンごとに専用 Loader を作成してアセットを読み込み、
 * シーン破棄時に関連アセットもまとめて破棄する。
 */
export class SceneRuntime<TRoutes extends SceneRouteMap> {
  private _root: DisplayObject;
  private _context: AppContext;
  private _routes: SceneDefinitions<TRoutes>;
  private _currentManagedScene: ManagedScene<TRoutes> | null = null;
  private _sceneStack: ManagedScene<TRoutes>[] = [];
  private _navigationQueue = Promise.resolve();
  private _onSceneChanged = createEventHandlers<SceneChangeEvent<TRoutes>>();
  private _onLoadingStateChanged = createEventHandlers<SceneLoadingState<TRoutes>>();

  readonly navigator: SceneNavigator<TRoutes>;

  constructor({ root, context, routes }: SceneRuntimeProps<TRoutes>) {
    this._root = root;
    this._context = context;
    this._routes = routes;
    this.navigator = {
      goTo: (...args) => this.goTo(...(args as any)),
      pushScene: (...args) => this.pushScene(...(args as any)),
      popScene: () => this.popScene(),
    };
  }

  /**
   * 現在表示中のシーンビュー
   */
  get currentView() {
    return this._currentManagedScene?.view ?? null;
  }

  /**
   * 現在表示中のシーンのルート情報
   */
  get currentRoute() {
    if (!this._currentManagedScene) {
      return null;
    }
    return {
      sceneKey: this._currentManagedScene.key,
      params: this._currentManagedScene.params,
      meta: this._currentManagedScene.meta,
    };
  }

  /**
   * シーン遷移完了時に通知されるイベントリスナー
   */
  get onSceneChanged() {
    return this._onSceneChanged.listeners;
  }

  /**
   * シーン読み込み状態の変更時に通知されるイベントリスナー
   */
  get onLoadingStateChanged() {
    return this._onLoadingStateChanged.listeners;
  }

  /**
   * 現在のシーンを破棄し、新しいシーンに遷移
   *
   * @remarks
   * 退避中のシーンスタックもすべて破棄される。
   * アセットの読み込みやシーン生成に失敗した場合、現在のシーンは維持される。
   * @param args - 遷移先のシーンキーとパラメータ
   */
  async goTo<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    const [sceneKey, params] = args;
    return this._enqueueNavigation(async () => {
      const previousScene = this._currentManagedScene;
      const previousStack = [...this._sceneStack];
      const nextScene = await this._setupScene(sceneKey, params, () => this.goTo(sceneKey as any, params as any));

      try {
        await this._attachNextScene(nextScene);
        this._currentManagedScene = nextScene;
        this._sceneStack = [];
        await this._disposeScenes(previousScene ? [previousScene, ...previousStack] : previousStack);
        this._setLoadingState({ status: 'hidden' });
        this._onSceneChanged.emit({
          sceneKey,
          params: params as TRoutes[keyof TRoutes] | undefined,
          meta: nextScene.meta,
        });
      } catch (error) {
        await this._disposeManagedScene(nextScene);
        throw error;
      }
    });
  }

  /**
   * 現在のシーンをスタックに残して新しいシーンに遷移
   *
   * @remarks
   * もとのシーンは破棄されずにスタックへ退避され、`popScene()` で復帰できる。
   * アセットの読み込みやシーン生成に失敗した場合、元のシーン表示は復元される。
   * @param args - 遷移先のシーンキーとパラメータ
   */
  async pushScene<TKey extends keyof TRoutes>(...args: SceneNavigationArgs<TRoutes, TKey>) {
    const [sceneKey, params] = args;
    return this._enqueueNavigation(async () => {
      const previousScene = this._currentManagedScene;
      const nextScene = await this._setupScene(sceneKey, params, () => this.pushScene(sceneKey as any, params as any));

      try {
        if (previousScene) {
          this._root.removeChild(previousScene.view);
        }
        await this._attachNextScene(nextScene);
        this._currentManagedScene = nextScene;
        if (previousScene) {
          this._sceneStack.push(previousScene);
        }
        this._setLoadingState({ status: 'hidden' });
        this._onSceneChanged.emit({
          sceneKey,
          params: params as TRoutes[keyof TRoutes] | undefined,
          meta: nextScene.meta,
        });
      } catch (error) {
        if (previousScene) {
          this._root.addChild(previousScene.view);
        }
        await this._disposeManagedScene(nextScene);
        throw error;
      }
    });
  }

  /**
   * 現在のシーンを破棄し、スタックに残した前のシーンに遷移
   *
   * @remarks
   * スタックが空の場合は何もしない。
   */
  async popScene() {
    return this._enqueueNavigation(async () => {
      const previousScene = this._sceneStack.pop();
      const currentManagedScene = this._currentManagedScene;

      if (!previousScene || !currentManagedScene) {
        if (previousScene) {
          this._sceneStack.push(previousScene);
        }
        return;
      }

      try {
        this._root.addChild(previousScene.view);
        this._currentManagedScene = previousScene;
        await this._disposeManagedScene(currentManagedScene);
        this._onSceneChanged.emit({
          sceneKey: previousScene.key,
          params: previousScene.params,
          meta: previousScene.meta,
        });
      } catch (error) {
        this._root.removeChild(previousScene.view);
        this._currentManagedScene = currentManagedScene;
        this._sceneStack.push(previousScene);
        throw error;
      }
    });
  }

  private _enqueueNavigation(task: () => Promise<void>) {
    const nextNavigation = this._navigationQueue.then(task);
    this._navigationQueue = nextNavigation.catch(() => {});
    return nextNavigation;
  }

  private async _setupScene<TKey extends keyof TRoutes>(
    sceneKey: TKey,
    params: TRoutes[TKey] | undefined,
    retry: () => Promise<void>,
  ) {
    const loader = createProxyLoader(this._context.app.createLoader(), this._context.loader);
    const definition = this._routes[sceneKey];
    const sceneParams = params as TRoutes[TKey];
    const loadingRequest = {
      status: 'loading' as const,
      sceneKey,
      params: params as TRoutes[keyof TRoutes] | undefined,
    };

    try {
      let assets: Record<string, unknown> = {};

      if (definition.getAssets) {
        this._setLoadingState({
          ...loadingRequest,
          assetLoading: null,
        });

        const assetDefinitions = await definition.getAssets({
          context: { ...this._context, loader },
          sceneKey,
          params: sceneParams,
        });

        let assetLoading: SceneAssetLoadingSnapshot = {
          progress: {
            total: Object.keys(assetDefinitions).length,
            completed: 0,
            failed: 0,
            pending: Object.keys(assetDefinitions).length,
          },
        };

        this._setLoadingState({
          ...loadingRequest,
          assetLoading,
        });

        const results = await loader.tryLoadAll(assetDefinitions, {
          onProgress: (snapshot) => {
            if (
              snapshot.progress.total === assetLoading.progress.total &&
              snapshot.progress.completed === assetLoading.progress.completed &&
              snapshot.progress.failed === assetLoading.progress.failed &&
              snapshot.progress.pending === assetLoading.progress.pending
            ) {
              return;
            }
            assetLoading = {
              progress: snapshot.progress,
            };
            this._setLoadingState({
              ...loadingRequest,
              assetLoading,
            });
          },
        });

        let firstError: unknown;
        for (const result of Object.values(results)) {
          if (!result.ok) {
            firstError ??= result.error;
          }
        }

        if (firstError !== undefined) {
          throw new SceneAssetLoadingError('Failed to load scene assets', {
            progress: assetLoading.progress,
            cause: firstError,
          });
        }

        assets = Object.fromEntries(
          Object.entries(results).map(([key, result]) => [key, (result as { ok: true; value: unknown }).value]),
        );
      }

      const sceneResult = await definition.create({
        context: { ...this._context, loader },
        sceneKey,
        params: sceneParams,
        assets: assets as any,
        navigator: this.navigator,
      });
      const scene = normalizeSceneResult(sceneResult);

      return {
        key: sceneKey,
        params: params as TRoutes[keyof TRoutes] | undefined,
        meta: definition.meta ?? {},
        view: scene.view,
        dispose: scene.dispose,
        loader,
      } satisfies ManagedScene<TRoutes>;
    } catch (error) {
      if (error instanceof SceneAssetLoadingError) {
        const assetLoading = {
          progress: error.progress,
        } satisfies SceneAssetLoadingSnapshot;
        this._setLoadingState({
          status: 'failed',
          sceneKey,
          params: params as TRoutes[keyof TRoutes] | undefined,
          assetLoading,
          error,
          retry,
        });
      }
      await loader.dispose();
      throw error;
    }
  }

  private async _attachNextScene(nextScene: ManagedScene<TRoutes>) {
    initializeSceneView(nextScene.view);
    this._root.addChild(nextScene.view);
  }

  private async _disposeManagedScene(scene: ManagedScene<TRoutes>) {
    await scene.dispose?.();
    scene.view.dispose();
    await scene.loader.dispose();
  }

  private async _disposeScenes(scenes: ManagedScene<TRoutes>[]) {
    for (const scene of scenes) {
      await this._disposeManagedScene(scene);
    }
  }

  private _setLoadingState(state: SceneLoadingState<TRoutes>) {
    this._onLoadingStateChanged.emit(state);
  }
}

function normalizeSceneResult(result: SceneCreateResult): SceneView {
  if (result instanceof DisplayObject) {
    return { view: result };
  }
  return result;
}

function initializeSceneView(view: DisplayObject) {
  if (!hasSceneViewInitializer(view)) {
    return;
  }
  view.init();
}

function hasSceneViewInitializer(view: DisplayObject): view is DisplayObject & { init: () => void } {
  return typeof (view as { init?: unknown }).init === 'function';
}

const TARGET_METHODS = ['get'] as const;

function createProxyLoader(loader: Loader, parentLoader: Loader) {
  return new Proxy(loader, {
    get(target, prop, receiver) {
      if (TARGET_METHODS.includes(prop as any)) {
        return (...args: any[]) => {
          const result = (target as any)[prop](...args);
          if (result !== undefined) {
            return result;
          }
          return (parentLoader as any)[prop](...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
