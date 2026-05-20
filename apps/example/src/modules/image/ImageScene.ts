import { DisplayObject, type DisplayObjectProps, imageAsset, Sprite } from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';

const imageAssets = sceneRouter.defineAssets('image', () => {
  return {
    imagePixel: imageAsset('img/image_pixel.png'),
  } as const;
});

type ImageSceneAssets = AssetsOf<typeof imageAssets>;

export const ImageSceneDef = sceneRouter.defineScene('image', {
  getAssets: imageAssets,
  create({ context, assets }) {
    return new ImageSceneView({ context, assets });
  },
});

export interface ImageSceneViewProps extends DisplayObjectProps {
  assets: ImageSceneAssets;
}

export class ImageSceneView extends DisplayObject {
  constructor(props: ImageSceneViewProps) {
    super(props);

    const { imagePixel: image } = props.assets;

    [
      { scaleX: 1, scaleY: 1, smooth: true },
      { scaleX: 2, scaleY: 2, smooth: true },
      { scaleX: 1, scaleY: 1, smooth: false },
      { scaleX: 2, scaleY: 2, smooth: false },
    ].forEach(({ scaleX, scaleY, smooth }, i) => {
      const sprite = new Sprite({
        context: this.context,
        image,
        scaleX,
        scaleY,
        smooth,
        anchorX: 0.5,
        anchorY: 0.5,
        x: 150 + i * 300,
        y: this.context.app.height / 2,
      });
      sprite.onUpdate.on(() => {
        sprite.rotation += 0.01;
      });
      this.addChild(sprite);
    });
  }
}
