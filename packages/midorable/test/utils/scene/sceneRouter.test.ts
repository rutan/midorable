import { describe, expect, it, vi } from 'vitest';
import { imageAsset, type ImageAsset } from '../../../src';
import { App } from '../../../src/core/App';
import { DisplayObject } from '../../../src/core/displays/DisplayObject';
import { createSceneRouter, type AssetsOf, type SceneRouteMap } from '../../../src/utils/scene';
import { createMockPlatform } from '../../helpers/createMockPlatform';

interface TestRoutes extends SceneRouteMap {
  title: undefined;
  game: { stageId: string };
  result: { score: number };
}

describe('scene2/SceneRouter', () => {
  it('allows event subscription before setup and throws on runtime access before setup', () => {
    const router = createSceneRouter<TestRoutes>();
    const onSceneChanged = () => {};
    const onLoadingStateChanged = () => {};

    expect(() => router.onSceneChanged.on(onSceneChanged)).not.toThrow();
    expect(() => router.onLoadingStateChanged.on(onLoadingStateChanged)).not.toThrow();
    router.onSceneChanged.off(onSceneChanged);
    router.onLoadingStateChanged.off(onLoadingStateChanged);

    expect(() => router.currentView).toThrow('SceneRouter is not set up');
    expect(() => router.goTo('title')).toThrow('SceneRouter is not set up');
  });

  it('defines scenes and navigates through the internal scene manager', async () => {
    const { platform } = createMockPlatform();
    const app = new App({ platform });
    const root = new DisplayObject({ context: app.context });
    const router = createSceneRouter<TestRoutes>();
    const changed: Array<keyof TestRoutes> = [];
    const receivedTitleImages: ImageAsset[] = [];

    const titleAssets = router.defineAssets('title', {
      titleImage: imageAsset('assets/title.png'),
    });

    type TitleAssets = AssetsOf<typeof titleAssets>;

    const titleSceneDef = router.defineScene('title', {
      getAssets: titleAssets,
      create({ context, assets }) {
        receivedTitleImages.push((assets satisfies TitleAssets).titleImage);
        return new DisplayObject({ context });
      },
    });

    const gameSceneDef = router.defineScene('game', {
      meta: {
        showBackButton: true,
      },
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    const resultSceneDef = router.defineScene('result', {
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    router.onSceneChanged.on(({ sceneKey, meta }) => {
      changed.push(sceneKey);
      expect(meta).toEqual(sceneKey === 'game' ? { showBackButton: true } : {});
    });

    router.setup({
      root,
      context: app.context,
      routes: {
        title: titleSceneDef,
        game: gameSceneDef,
        result: resultSceneDef,
      },
    });

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
    const router = createSceneRouter<TestRoutes>();
    const titleView = new DisplayObject({ context: app.context });
    const gameView = new DisplayObject({ context: app.context });
    const disposeGame = vi.fn();

    const titleSceneDef = router.defineScene('title', {
      create() {
        return titleView;
      },
    });

    const gameSceneDef = router.defineScene('game', {
      create() {
        return {
          view: gameView,
          dispose: disposeGame,
        };
      },
    });

    const resultSceneDef = router.defineScene('result', {
      create({ context }) {
        return new DisplayObject({ context });
      },
    });

    router.setup({
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
});
