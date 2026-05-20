import { DisplayObject, type DisplayObjectProps, imageAsset, Sprite } from '@rutan/midorable';
import { FONT_NAME, sceneRouter, type AssetsOf } from '../_share';

let shouldFailPreloadOnce = true;

const getAssets = sceneRouter.defineAssets('preload', async () => {
  await sleep(900);

  const images = {
    imagePixel: imageAsset('img/image_pixel.png'),
    _dummyImage1: imageAsset('img/image_pixel.png?v=1'),
    _dummyImage2: imageAsset('img/image_pixel.png?v=2'),
    _dummyImage3: imageAsset('img/image_pixel.png?v=3'),
    _dummyImage4: imageAsset('img/image_pixel.png?v=4'),
    _dummyImage5: imageAsset('img/image_pixel.png?v=5'),
    _dummyImage6: imageAsset('img/image_pixel.png?v=6'),
    _dummyImage7: imageAsset('img/image_pixel.png?v=7'),
    _dummyImage8: imageAsset('img/image_pixel.png?v=8'),
    _dummyImage9: imageAsset('img/image_pixel.png?v=9'),
  } as const;

  if (shouldFailPreloadOnce) {
    shouldFailPreloadOnce = false;
    return {
      ...images,
      imageFrame: imageAsset('img/does-not-exist.png'),
    } as const;
  }

  return {
    ...images,
    imageFrame: imageAsset('img/image_frame.png'),
  } as const;
});

type PreloadSceneAssets = AssetsOf<typeof getAssets>;

export const PreloadSceneDef = sceneRouter.defineScene('preload', {
  getAssets,
  create({ context, assets }) {
    return new PreloadSceneView({ context, assets });
  },
});

interface PreloadSceneViewProps extends DisplayObjectProps {
  assets: PreloadSceneAssets;
}

class PreloadSceneView extends DisplayObject {
  constructor(props: PreloadSceneViewProps) {
    super(props);

    shouldFailPreloadOnce = true; // シーン初期化時に毎回失敗するようにリセット

    const titleTexture = this.context.app.createTexture(760, 180);
    titleTexture.drawText({
      text: 'Preload Demo',
      x: 380,
      y: 12,
      font: { family: FONT_NAME, size: 40 },
      color: { r: 255, g: 255, b: 255, a: 1 },
      lineHeight: 44,
      align: 'center',
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 4,
    });
    titleTexture.drawText({
      text: 'First asset path is invalid on purpose',
      x: 380,
      y: 68,
      font: { family: FONT_NAME, size: 24 },
      color: { r: 160, g: 222, b: 255, a: 1 },
      lineHeight: 28,
      align: 'center',
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 3,
    });
    titleTexture.drawText({
      text: 'Retry from loading UI to continue',
      x: 380,
      y: 104,
      font: { family: FONT_NAME, size: 24 },
      color: { r: 160, g: 222, b: 255, a: 1 },
      lineHeight: 28,
      align: 'center',
      outlineColor: { r: 0, g: 0, b: 0, a: 1 },
      outlineWidth: 3,
    });
    const titleSprite = new Sprite({
      context: this.context,
      image: titleTexture,
      x: (this.context.app.width - titleTexture.width) / 2,
      y: 72,
    });
    this.addChild(titleSprite);

    const imageSprite = new Sprite({
      context: this.context,
      image: props.assets.imageFrame,
      anchorX: 0.5,
      anchorY: 0.5,
      x: this.context.app.width / 2,
      y: 420,
    });
    imageSprite.onUpdate.on(() => {
      imageSprite.rotation += 0.01;
    });
    this.addChild(imageSprite);

    const pixelSprite = new Sprite({
      context: this.context,
      image: props.assets.imagePixel,
      x: 160,
      y: 500,
      scaleX: 8,
      scaleY: 8,
      smooth: false,
    });
    this.addChild(pixelSprite);
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
