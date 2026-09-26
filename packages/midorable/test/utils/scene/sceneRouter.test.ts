import { describe, expect, it, vi, type MockInstance } from 'vitest';
import { imageAsset, type ImageAsset } from '../../../src';
import { App } from '../../../src/engine/App';
import { DisplayObject } from '../../../src/engine/displays/DisplayObject';
import {
  createSceneHelpers,
  createSceneRouter,
  type AssetsOf,
  type SceneDefinitions,
  type SceneNavigator,
  type SceneRouteMap,
} from '../../../src/utils/scene';
import { createMockPlatform } from '../../helpers/createMockPlatform';

interface TestRoutes extends SceneRouteMap {
  title: undefined;
  game: { stageId: string };
  result: { score: number };
}

describe('SceneRouter', () => {
  it('loads typed scene assets and emits route metadata', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const { defineScene, defineAssets } = createSceneHelpers<TestRoutes>();
    const changed: Array<keyof TestRoutes> = [];
    const receivedTitleImages: ImageAsset[] = [];

    const titleAssets = defineAssets('title', {
      titleImage: imageAsset('assets/title.png'),
    });

    type TitleAssets = AssetsOf<typeof titleAssets>;

    const titleSceneDef = defineScene('title', {
      getAssets: titleAssets,
      create({ context, assets }) {
        receivedTitleImages.push((assets satisfies TitleAssets).titleImage);
        return new DisplayObject({ context });
      },
    });

    const gameSceneDef = defineScene('game', {
      meta: {
        showBackButton: true,
      },
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    const resultSceneDef = defineScene('result', {
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    const router = createSceneRouter<TestRoutes>({
      root,
      context: app.context,
      routes: {
        title: titleSceneDef,
        game: gameSceneDef,
        result: resultSceneDef,
      },
    });

    router.onSceneChanged.on(({ sceneKey, meta }) => {
      changed.push(sceneKey);
      expect(meta).toEqual(sceneKey === 'game' ? { showBackButton: true } : {});
    });

    expect(router.currentView).toBeNull();
    expect(router.currentRoute).toBeNull();

    await router.goTo('title');
    await router.goTo('game', { stageId: 'stage-1' });

    expect(receivedTitleImages[0]?.type).toBe('image');
    expect(changed).toEqual(['title', 'game']);
    expect(router.currentRoute?.sceneKey).toBe('game');
    expect(root.children).toHaveLength(1);
  });

  it('accepts plain DisplayObject scene views and explicit scene view lifecycles', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const { defineScene } = createSceneHelpers<TestRoutes>();
    const titleView = new DisplayObject({ context: app.context });
    const gameView = new DisplayObject({ context: app.context });
    const disposeGame = vi.fn();

    const titleSceneDef = defineScene('title', {
      create() {
        return titleView;
      },
    });

    const gameSceneDef = defineScene('game', {
      create() {
        return {
          view: gameView,
          dispose: disposeGame,
        };
      },
    });

    const resultSceneDef = defineScene('result', {
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    const router = createSceneRouter<TestRoutes>({
      root,
      context: app.context,
      routes: {
        title: titleSceneDef,
        game: gameSceneDef,
        result: resultSceneDef,
      },
    });

    await router.goTo('title');

    expect(router.currentView).toBe(titleView);
    expect(router.currentRoute).toEqual({ sceneKey: 'title', params: undefined, meta: {} });
    expect(root.children).toEqual([titleView]);

    await router.goTo('game', { stageId: 'stage-1' });

    expect(router.currentView).toBe(gameView);
    expect(disposeGame).not.toHaveBeenCalled();

    await router.goTo('result', { score: 100 });

    expect(disposeGame).toHaveBeenCalledTimes(1);
    expect(router.currentRoute).toEqual({ sceneKey: 'result', params: { score: 100 }, meta: {} });
  });

  it('shares definitions while keeping application navigation, assets and events independent', async () => {
    type Routes = { main: undefined; overlay: undefined };
    const { defineScene, defineAssets } = createSceneHelpers<Routes>();
    const appA = new App({ platform: createMockPlatform().platform });
    const appB = new App({ platform: createMockPlatform().platform });
    const readyA = Promise.withResolvers<void>();
    const navigators = new Map<App, SceneNavigator<Routes>>();
    const routes = {
      main: defineScene('main', {
        getAssets: defineAssets('main', { image: imageAsset('shared.png') }),
        async create({ context, navigator }) {
          if (context.app === appA) await readyA.promise;
          navigators.set(context.app, navigator);
          return new DisplayObject({ context });
        },
      }),
      overlay: defineScene('overlay', {
        create: ({ context }) => new DisplayObject({ context }),
      }),
    } satisfies SceneDefinitions<Routes>;
    const routerA = createSceneRouter<Routes>({ root: appA.root, context: appA.context, routes });
    const routerB = createSceneRouter<Routes>({ root: appB.root, context: appB.context, routes });
    const changedA = vi.fn();
    const changedB = vi.fn();
    const loadingB = vi.fn();
    routerA.onSceneChanged.on(changedA);
    routerB.onSceneChanged.on(changedB);
    routerB.onLoadingStateChanged.on(loadingB);

    const transitionA = routerA.goTo('main');
    await routerB.goTo('main');
    expect(changedA).not.toHaveBeenCalled();
    expect(changedB).toHaveBeenCalledTimes(1);
    const loadingEventsB = loadingB.mock.calls.length;
    readyA.resolve();
    await transitionA;

    const viewA = routerA.currentView!;
    const viewB = routerB.currentView!;
    expect(viewA).not.toBe(viewB);
    expect(viewA.context.app).toBe(appA);
    expect(viewB.context.app).toBe(appB);
    expect(viewA.context.loader.get('image')).not.toBe(viewB.context.loader.get('image'));

    await navigators.get(appA)!.pushScene('overlay');
    expect(routerA.currentRoute?.sceneKey).toBe('overlay');
    expect(routerB.currentView).toBe(viewB);
    await routerB.popScene();
    expect(routerB.currentView).toBe(viewB);
    await routerA.popScene();
    expect(routerA.currentView).toBe(viewA);
    await routerA.dispose();

    expect(appA.root.children).toEqual([]);
    expect(viewA.context.loader.disposed).toBe(true);
    expect(viewB.context.loader.disposed).toBe(false);
    expect(appB.root.children).toEqual([viewB]);
    expect(changedB).toHaveBeenCalledTimes(1);
    expect(loadingB).toHaveBeenCalledTimes(loadingEventsB);
    await navigators.get(appB)!.goTo('overlay');
    expect(routerB.currentRoute?.sceneKey).toBe('overlay');
    await routerB.dispose();
  });

  it.each([false, true])('disposes current and stacked scenes once (cleanup fails: %s)', async (cleanupFails) => {
    const app = new App({ platform: createMockPlatform().platform });
    const unrelatedView = new DisplayObject({ context: app.context });
    app.root.addChild(unrelatedView);
    const cleanupError = new Error('cleanup failed');
    const viewError = new Error('view disposal failed');
    const scenes: Array<{
      view: DisplayObject;
      dispose: ReturnType<typeof vi.fn>;
      disposeView: MockInstance<() => void>;
    }> = [];
    let navigator!: SceneNavigator<{ main: undefined }>;
    const router = createSceneRouter<{ main: undefined }>({
      root: app.root,
      context: app.context,
      routes: {
        main: {
          create(props) {
            navigator = props.navigator;
            const view = new DisplayObject({ context: props.context });
            const originalDispose = view.dispose.bind(view);
            const disposeView = vi.spyOn(view, 'dispose');
            const index = scenes.length;
            if (cleanupFails && index === 1) {
              disposeView.mockImplementation(async () => {
                originalDispose();
                await Promise.resolve();
                throw viewError;
              });
            }
            const scene = {
              view,
              dispose: vi.fn(async () => {
                expect(view.parent).toBeNull();
                if (cleanupFails && index === 1) throw cleanupError;
              }),
            };
            scenes.push({ ...scene, disposeView });
            return scene;
          },
        },
      },
    });
    await router.goTo('main');
    await router.pushScene('main');

    const disposal = router.dispose();
    if (cleanupFails) {
      await expect(disposal).rejects.toMatchObject({ name: 'AggregateError', errors: [cleanupError, viewError] });
    } else {
      await disposal;
    }
    await router.dispose().catch(() => {});

    for (const scene of scenes) {
      expect(scene.dispose).toHaveBeenCalledTimes(1);
      expect(scene.disposeView).toHaveBeenCalledTimes(1);
      expect(scene.view.context.loader.disposed).toBe(true);
    }
    expect(router.currentView).toBeNull();
    expect(router.currentRoute).toBeNull();
    expect(app.root.children).toEqual([unrelatedView]);
    expect(app.context.loader.disposed).toBe(false);
    await expect(router.goTo('main')).rejects.toThrow('SceneRouter has been disposed');
    await expect(navigator.popScene()).rejects.toThrow('SceneRouter has been disposed');
  });

  it('finishes accepted transitions before disposal and rejects new navigation', async () => {
    const app = new App({ platform: createMockPlatform().platform });
    const started = Promise.withResolvers<void>();
    const ready = Promise.withResolvers<void>();
    const views: DisplayObject[] = [];
    const router = createSceneRouter<{ main: undefined; overlay: undefined }>({
      root: app.root,
      context: app.context,
      routes: {
        main: {
          async create({ context }) {
            started.resolve();
            await ready.promise;
            const view = new DisplayObject({ context });
            views.push(view);
            return view;
          },
        },
        overlay: {
          create({ context }) {
            const view = new DisplayObject({ context });
            views.push(view);
            return view;
          },
        },
      },
    });
    const changed: string[] = [];
    router.onSceneChanged.on(({ sceneKey }) => changed.push(sceneKey));
    const first = router.goTo('main');
    const second = router.pushScene('overlay');
    await started.promise;
    const disposal = router.dispose();
    await expect(router.pushScene('main')).rejects.toThrow('SceneRouter has been disposed');
    ready.resolve();
    await Promise.all([first, second, disposal]);

    expect(changed).toEqual(['main', 'overlay']);
    expect(router.currentView).toBeNull();
    expect(app.root.children).toEqual([]);
    expect(views.every((view) => view.context.loader.disposed)).toBe(true);
  });
});
