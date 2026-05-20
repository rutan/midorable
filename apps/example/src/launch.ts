import { App, imageAsset, type Platform } from '@rutan/midorable';
import {
  BUTTON_IMAGE_KEY,
  ExampleLoadingView,
  FONT_NAME,
  FpsCounterSprite,
  sceneRouter,
  TextButtonSprite,
} from './modules/_share';
import { AudioSceneDef } from './modules/audio';
import { ColorSceneDef } from './modules/color';
import { FeatureSceneDef } from './modules/feature';
import { ImageSceneDef } from './modules/image';
import { LoaderSceneDef } from './modules/loader';
import { MaskSceneDef } from './modules/mask';
import { MenuSceneDef } from './modules/menu';
import { NestObjectSceneDef } from './modules/nestObject';
import { NinePatchSceneDef } from './modules/ninePatch/NinePatchScene';
import { ParticleSceneDef } from './modules/particle';
import { PointerSceneDef } from './modules/pointer';
import { PreloadSceneDef } from './modules/preload';
import { RectangleSceneDef } from './modules/rectangle';
import { ShaderSceneDef } from './modules/shader';
import { TextSceneDef } from './modules/text';
import { Stage } from './stage';

export async function launch(platformInstance: Platform) {
  const app = new App({
    platform: platformInstance,
    width: 1280,
    height: 720,
  });

  const fontFeature = app.getFeature('system.font');
  if (fontFeature) {
    await fontFeature.loadFont(FONT_NAME, './fonts/MPLUSRounded1c-Regular.ttf');
  }

  // 共通リソースの読み込み
  await app.context.loader.load(imageAsset('img/button.png'), { key: BUTTON_IMAGE_KEY });

  const stage = new Stage({
    context: app.context,
  });
  app.root.addChild(stage);

  const backButton = new TextButtonSprite({
    context: app.context,
    label: 'Back',
    width: 120,
    height: 64,
  });
  backButton.onClickButton.on(() => {
    void sceneRouter.goTo('menu', { startTime: performance.now() });
  });
  app.root.addChild(backButton);

  const fpsCounter = new FpsCounterSprite({
    context: app.context,
    x: app.width - 120 - 10,
    y: 10,
  });
  app.root.addChild(fpsCounter);

  const loadingView = new ExampleLoadingView({ context: app.context });
  app.root.addChild(loadingView);

  sceneRouter.setup({
    root: stage.mainLayer,
    context: app.context,
    routes: {
      menu: MenuSceneDef,
      rectangle: RectangleSceneDef,
      image: ImageSceneDef,
      nestObject: NestObjectSceneDef,
      color: ColorSceneDef,
      mask: MaskSceneDef,
      ninePatch: NinePatchSceneDef,
      pointer: PointerSceneDef,
      text: TextSceneDef,
      audio: AudioSceneDef,
      loader: LoaderSceneDef,
      particle: ParticleSceneDef,
      shader: ShaderSceneDef,
      feature: FeatureSceneDef,
      preload: PreloadSceneDef,
    },
  });
  sceneRouter.onLoadingStateChanged.on((state) => {
    loadingView.setState(state);
  });
  sceneRouter.onSceneChanged.on(({ sceneKey, meta }) => {
    console.log(`Scene changed: ${String(sceneKey)}`);

    backButton.visible = meta.showBackButton !== false;
  });

  await sceneRouter.goTo('menu', { startTime: performance.now() });

  await app.start();
}
