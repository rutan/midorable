import { type AppContext, createEventHandlers, DisplayObject, Loader } from '../../../engine';
import type { SceneCreateResult, SceneDefinitions, SceneView } from '../definition';
import { SceneAssetLoadingError } from '../errors';
import type { SceneNavigator } from '../navigator';
import type { SceneRouterConfig } from '../SceneRouter';
import type {
  SceneAssetLoadingSnapshot,
  SceneChangeEvent,
  SceneLoadingState,
  SceneNavigationArgs,
  SceneRouteMap,
} from '../types';
import { createManagedScene, type ManagedScene } from './ManagedScene';

interface ScenePreparationFailure {
  error: unknown;
  cleanupErrors: readonly unknown[];
  loadingStarted: boolean;
}

type ScenePreparationResult<TRoutes extends SceneRouteMap> =
  | { ok: true; scene: ManagedScene<TRoutes>; loadingStarted: boolean }
  | ({ ok: false } & ScenePreparationFailure);

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
  private _scenes: ManagedScene<TRoutes>[] = [];
  private _navigationQueue = Promise.resolve();
  private _disposePromise: Promise<void> | null = null;
  private _onSceneChanged = createEventHandlers<SceneChangeEvent<TRoutes>>();
  private _onLoadingStateChanged = createEventHandlers<SceneLoadingState<TRoutes>>();

  readonly navigator: SceneNavigator<TRoutes>;

  constructor({ root, context, routes }: SceneRouterConfig<TRoutes>) {
    this._root = root;
    this._context = context;
    this._routes = routes;
    this.navigator = {
      goTo: (...args) => this.goTo(...(args as any)),
      pushScene: (...args) => this.pushScene(...(args as any)),
      popScene: () => this.popScene(),
    };
  }

  private get _currentScene() {
    return this._scenes.at(-1) ?? null;
  }

  /** 全破棄の順序は、現在のシーン、続いて退避中のシーンを配列順とする。 */
  private _scenesInDisposalOrder() {
    const current = this._currentScene;
    return current ? [current, ...this._scenes.slice(0, -1)] : [];
  }

  /**
   * 現在表示中のシーンビュー
   */
  get currentView() {
    return this._currentScene?.view ?? null;
  }

  /**
   * 現在表示中のシーンのルート情報
   */
  get currentRoute() {
    if (!this._currentScene) return null;

    return {
      sceneKey: this._currentScene.key,
      params: this._currentScene.params,
      meta: this._currentScene.meta,
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
      const scenesToDispose = this._scenesInDisposalOrder();
      const retry = () => this.goTo<TKey>(...args);
      const preparation = await this._prepareScene(sceneKey, params);
      if (!preparation.ok) {
        this._failTransition(sceneKey, params, preparation, retry);
      }

      const { scene, loadingStarted } = preparation;
      try {
        this._commitScenes([scene]);
      } catch (error) {
        this._failTransition(sceneKey, params, { error, cleanupErrors: await scene.dispose(), loadingStarted }, retry);
      }

      await this._finishTransition(scene, scenesToDispose, true);
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
      const retry = () => this.pushScene<TKey>(...args);
      const preparation = await this._prepareScene(sceneKey, params);
      if (!preparation.ok) {
        this._failTransition(sceneKey, params, preparation, retry);
      }

      const { scene, loadingStarted } = preparation;
      try {
        this._commitScenes([...this._scenes, scene]);
      } catch (error) {
        this._failTransition(sceneKey, params, { error, cleanupErrors: await scene.dispose(), loadingStarted }, retry);
      }

      await this._finishTransition(scene, [], true);
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
      const previousScene = this._scenes.at(-2);
      const currentScene = this._currentScene;
      if (!previousScene || !currentScene) return;

      this._commitScenes(this._scenes.slice(0, -1));
      await this._finishTransition(previousScene, [currentScene], false);
    });
  }

  dispose(): Promise<void> {
    if (this._disposePromise) return this._disposePromise;

    this._disposePromise = this._navigationQueue.then(async () => {
      const scenes = this._scenesInDisposalOrder();
      try {
        this._commitScenes([]);
        const errors = await this._disposeScenes(scenes);
        if (errors.length > 0) {
          throw new AggregateError(errors, 'Failed to dispose scenes');
        }
      } finally {
        this._onSceneChanged.listeners.offAll();
        this._onLoadingStateChanged.listeners.offAll();
      }
    });

    return this._disposePromise;
  }

  private _enqueueNavigation(task: () => Promise<void>) {
    if (this._disposePromise) {
      return Promise.reject(new Error('SceneRouter has been disposed'));
    }

    const nextNavigation = this._navigationQueue.then(task);
    this._navigationQueue = nextNavigation.catch(() => {});
    return nextNavigation;
  }

  private async _prepareScene<TKey extends keyof TRoutes>(
    sceneKey: TKey,
    params: TRoutes[TKey] | undefined,
  ): Promise<ScenePreparationResult<TRoutes>> {
    let loader: Loader | undefined;
    let scene: ManagedScene<TRoutes> | undefined;
    let loadingStarted = false;
    const loadingRequest = {
      status: 'loading' as const,
      sceneKey,
      params: params as TRoutes[keyof TRoutes] | undefined,
    };

    try {
      loader = createProxyLoader(this._context.app.createLoader(), this._context.loader);
      const definition = this._routes[sceneKey];
      const sceneParams = params as TRoutes[TKey];
      let assets: Record<string, unknown> = {};

      if (definition.getAssets) {
        loadingStarted = true;
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
      scene = createManagedScene<TRoutes>(
        { sceneKey, params: sceneParams, meta: definition.meta ?? {} },
        normalizeSceneResult(sceneResult),
        loader,
      );
      initializeSceneView(scene.view);
      return { ok: true, scene, loadingStarted };
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      if (scene) {
        cleanupErrors.push(...(await scene.dispose()));
      } else if (loader) {
        try {
          await loader.dispose();
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      return { ok: false, error, cleanupErrors, loadingStarted };
    }
  }

  private _failTransition<TKey extends keyof TRoutes>(
    sceneKey: TKey,
    params: TRoutes[TKey] | undefined,
    { error, cleanupErrors, loadingStarted }: ScenePreparationFailure,
    retry: () => Promise<void>,
  ): never {
    const errors = [error, ...cleanupErrors];
    try {
      if (error instanceof SceneAssetLoadingError) {
        this._setLoadingState({
          status: 'failed',
          sceneKey,
          params: params as TRoutes[keyof TRoutes] | undefined,
          assetLoading: { progress: error.progress },
          error,
          retry,
        });
      } else if (loadingStarted) {
        this._setLoadingState({ status: 'hidden' });
      }
    } catch (notificationError) {
      errors.push(notificationError);
    }
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, 'Failed to prepare scene transition');
  }

  private _commitScenes(nextScenes: ManagedScene<TRoutes>[]) {
    const previous = this._currentScene;
    const next = nextScenes.at(-1);
    if (next !== previous) {
      if (next) this._root.addChild(next.view);
      if (previous) this._root.removeChild(previous.view);
    }
    this._scenes = nextScenes;
  }

  private async _finishTransition(
    scene: ManagedScene<TRoutes>,
    scenesToDispose: ManagedScene<TRoutes>[],
    hideLoading: boolean,
  ) {
    const errors = await this._disposeScenes(scenesToDispose);
    if (hideLoading) {
      try {
        this._setLoadingState({ status: 'hidden' });
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      this._onSceneChanged.emit({ sceneKey: scene.key, params: scene.params, meta: scene.meta });
    } catch (error) {
      errors.push(error);
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Failed to finish scene transition');
    }
  }

  private async _disposeScenes(scenes: ManagedScene<TRoutes>[]) {
    const errors: unknown[] = [];
    for (const scene of scenes) {
      errors.push(...(await scene.dispose()));
    }
    return errors;
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

function createProxyLoader(loader: Loader, parentLoader: Loader) {
  return new Proxy(loader, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        return (key: string) => target.get(key) ?? parentLoader.get(key);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
