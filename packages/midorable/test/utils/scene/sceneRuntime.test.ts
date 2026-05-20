import { describe, expect, it, vi } from 'vitest';
import { imageAsset, type AssetSpec } from '../../../src';
import { App } from '../../../src/core/App';
import type { AppContext } from '../../../src/core/App';
import { DisplayObject, type DisplayObjectProps } from '../../../src/core/displays/DisplayObject';
import {
  createSceneRouter,
  SceneAssetLoadingError,
  type SceneLoadingState,
  type SceneNavigator,
  type SceneRouteMap,
} from '../../../src/utils/scene';
import { createAudioAsset, createImageAsset, createMockPlatform } from '../../helpers/createMockPlatform';

interface TestRoutes extends SceneRouteMap {
  first: undefined;
  second: { id: number };
}

async function flushTransitions() {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
}

interface TestSceneProps<TKey extends keyof TestRoutes, TAssets = {}> extends DisplayObjectProps {
  sceneKey: TKey;
  params: TestRoutes[TKey];
  assets: TAssets;
  navigator: SceneNavigator<TestRoutes>;
}

class TestScene<TKey extends keyof TestRoutes, TAssets = {}> extends DisplayObject {
  protected _inited = false;
  protected _sceneKey: TKey;
  protected _params: TestRoutes[TKey];
  protected _assets: TAssets;
  protected _navigator: SceneNavigator<TestRoutes>;

  constructor(props: TestSceneProps<TKey, TAssets>) {
    super(props);
    this._sceneKey = props.sceneKey;
    this._params = props.params;
    this._assets = props.assets;
    this._navigator = props.navigator;
  }

  get sceneKey() {
    return this._sceneKey;
  }

  get navigator() {
    return this._navigator;
  }

  init() {
    if (this._inited) {
      return;
    }
    this._inited = true;
    this.onInit();
  }

  onInit() {}
}

class TransitionScene extends TestScene<'first'> {
  goToSecond(id: number) {
    void this.navigator.goTo('second', { id });
  }
}

class TestLoadingStateRecorder {
  states: SceneLoadingState<TestRoutes>[] = [];

  handle(state: SceneLoadingState<TestRoutes>) {
    this.states.push(state);
  }
}

describe('SceneRouter runtime', () => {
  it('creates scenes from route definitions and navigates via scene navigator', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    let receivedParams: TestRoutes['second'] | undefined;

    const router = createSceneRouter<TestRoutes>();

    router.setup({
      root,
      context: app.context,
      routes: {
        first: {
          create({ context, navigator }) {
            return new TransitionScene({
              context,
              sceneKey: 'first',
              params: undefined,
              assets: {},
              navigator,
            });
          },
        },
        second: {
          create({ context, params, navigator }) {
            receivedParams = params;
            return new TestScene<'second'>({
              context,
              sceneKey: 'second',
              params,
              assets: {},
              navigator,
            });
          },
        },
      },
    });

    await router.goTo('first');
    const firstView = router.currentView;
    if (!(firstView instanceof TransitionScene)) {
      throw new Error('first scene was not created as TransitionScene');
    }

    firstView.goToSecond(7);
    await flushTransitions();

    expect(receivedParams).toEqual({ id: 7 });
    expect(router.currentView).not.toBe(firstView);
    expect(root.children).toHaveLength(1);
  });

  it('creates a dedicated loader per scene and unloads the previous one', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const loaders: AppContext['loader'][] = [];

    const router = createSceneRouter<TestRoutes>();

    router.setup({
      root,
      context: app.context,
      routes: {
        first: {
          create({ context, navigator }) {
            loaders.push(context.loader);
            return new TestScene<'first'>({
              context,
              sceneKey: 'first',
              params: undefined,
              assets: {},
              navigator,
            });
          },
        },
        second: {
          create({ context, params, navigator }) {
            loaders.push(context.loader);
            return new TestScene<'second'>({
              context,
              sceneKey: 'second',
              params,
              assets: {},
              navigator,
            });
          },
        },
      },
    });

    await router.goTo('first');
    const firstLoader = loaders[0];
    const firstLoaderDispose = vi.spyOn(firstLoader, 'dispose');

    await router.goTo('second', { id: 1 });

    expect(loaders).toHaveLength(2);
    expect(firstLoader).not.toBe(app.context.loader);
    expect(loaders[1]).not.toBe(firstLoader);
    expect(firstLoaderDispose).toHaveBeenCalledTimes(1);
    expect(firstLoader.disposed).toBe(true);
  });

  it('preloads scene assets and emits loading state changes', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const loadingStateRecorder = new TestLoadingStateRecorder();
    const preloadedImage = createImageAsset('img/preloaded.png');
    vi.mocked(platform.loadAsset).mockResolvedValue(preloadedImage);
    let receivedAsset = null as ReturnType<AppContext['loader']['get']> | null;

    const getAssets = () => ({
      imagePixel: imageAsset('img/preloaded.png'),
    });

    const router = createSceneRouter<TestRoutes>();

    router.onLoadingStateChanged.on((state) => {
      loadingStateRecorder.handle(state);
    });
    router.setup({
      root,
      context: app.context,
      routes: {
        first: {
          getAssets,
          create({ context, assets, navigator }) {
            receivedAsset = assets.imagePixel;
            expect(context.loader.get('imagePixel')).toBe(preloadedImage);
            return new TestScene<'first', typeof assets>({
              context,
              sceneKey: 'first',
              params: undefined,
              assets,
              navigator,
            });
          },
        },
        second: {
          create({ context, params, navigator }) {
            return new TestScene<'second'>({
              context,
              sceneKey: 'second',
              params,
              assets: {},
              navigator,
            });
          },
        },
      },
    });

    await router.goTo('first');

    expect(receivedAsset).toBe(preloadedImage);
    expect(loadingStateRecorder.states).toEqual([
      {
        status: 'loading',
        sceneKey: 'first',
        params: undefined,
        assetLoading: null,
      },
      {
        status: 'loading',
        sceneKey: 'first',
        params: undefined,
        assetLoading: {
          progress: { total: 1, completed: 0, failed: 0, pending: 1 },
        },
      },
      {
        status: 'loading',
        sceneKey: 'first',
        params: undefined,
        assetLoading: {
          progress: { total: 1, completed: 1, failed: 0, pending: 0 },
        },
      },
      {
        status: 'hidden',
      },
    ]);
  });

  it('reports asset loading failures and exposes retry from loading state', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const loadingStateRecorder = new TestLoadingStateRecorder();
    let shouldFail = true;

    vi.mocked(platform.loadAsset).mockImplementation(async (spec: AssetSpec) => {
      if (spec.type !== 'audio') {
        throw new Error(`unexpected asset type: ${spec.type}`);
      }
      if (shouldFail) {
        shouldFail = false;
        throw new Error('audio missing');
      }
      return createAudioAsset(spec.src);
    });

    const failingAssets = () =>
      ({
        voice: { type: 'audio', src: 'audio/voice.mp3' },
      }) as const;

    const router = createSceneRouter<TestRoutes>();

    router.onLoadingStateChanged.on((state) => {
      loadingStateRecorder.handle(state);
    });
    router.setup({
      root,
      context: app.context,
      routes: {
        first: {
          getAssets: failingAssets,
          create({ context, navigator }) {
            return new TestScene<'first'>({
              context,
              sceneKey: 'first',
              params: undefined,
              assets: {},
              navigator,
            });
          },
        },
        second: {
          create({ context, params, navigator }) {
            return new TestScene<'second'>({
              context,
              sceneKey: 'second',
              params,
              assets: {},
              navigator,
            });
          },
        },
      },
    });

    await expect(router.goTo('first')).rejects.toBeInstanceOf(SceneAssetLoadingError);

    const failedState = loadingStateRecorder.states.at(-1);
    expect(failedState?.status).toBe('failed');
    if (!failedState || failedState.status !== 'failed') {
      throw new Error('failed state was not emitted');
    }

    expect(failedState.assetLoading).toMatchObject({
      progress: { total: 1, completed: 0, failed: 1, pending: 0 },
    });

    await failedState.retry();

    expect(loadingStateRecorder.states.at(-1)).toEqual({ status: 'hidden' });
  });

  it('retries failed pushScene transitions as pushScene transitions', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const loadingStateRecorder = new TestLoadingStateRecorder();
    let shouldFail = true;

    vi.mocked(platform.loadAsset).mockImplementation(async (spec: AssetSpec) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('audio missing');
      }
      return createAudioAsset(spec.src);
    });

    const router = createSceneRouter<TestRoutes>();

    router.onLoadingStateChanged.on((state) => {
      loadingStateRecorder.handle(state);
    });
    router.setup({
      root,
      context: app.context,
      routes: {
        first: {
          create({ context, navigator }) {
            return new TestScene<'first'>({
              context,
              sceneKey: 'first',
              params: undefined,
              assets: {},
              navigator,
            });
          },
        },
        second: {
          getAssets: () =>
            ({
              voice: { type: 'audio', src: 'audio/voice.mp3' },
            }) as const,
          create({ context, params, navigator }) {
            return new TestScene<'second'>({
              context,
              sceneKey: 'second',
              params,
              assets: {},
              navigator,
            });
          },
        },
      },
    });

    await router.goTo('first');
    const firstView = router.currentView;

    await expect(router.pushScene('second', { id: 2 })).rejects.toBeInstanceOf(SceneAssetLoadingError);

    const failedState = loadingStateRecorder.states.at(-1);
    if (!failedState || failedState.status !== 'failed') {
      throw new Error('failed state was not emitted');
    }

    await failedState.retry();

    expect(router.currentRoute?.sceneKey).toBe('second');
    await router.popScene();
    expect(router.currentView).toBe(firstView);
  });
});
