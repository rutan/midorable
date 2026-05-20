import { DisplayObject, type DisplayObjectProps, imageAsset, Sprite } from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';

const maskSceneAssets = sceneRouter.defineAssets('mask', () => ({
  back: imageAsset('img/back.jpg'),
  maskImage: imageAsset('img/character.png'),
}));

type MaskSceneAssets = AssetsOf<typeof maskSceneAssets>;

export const MaskSceneDef = sceneRouter.defineScene('mask', {
  getAssets: maskSceneAssets,
  create({ context, assets }) {
    return new MaskSceneView({ context, assets });
  },
});

export interface MaskSceneViewProps extends DisplayObjectProps {
  assets: MaskSceneAssets;
}

export class MaskSceneView extends DisplayObject {
  constructor(props: MaskSceneViewProps) {
    super(props);

    const { back, maskImage } = props.assets;

    const mask = new Sprite({
      context: this.context,
      image: maskImage,
      anchorX: 0.5,
      anchorY: 0.5,
    });

    let frame = 0;
    mask.onUpdate.on(() => {
      mask.rotation += 0.01;
      mask.scaleX = 1 + Math.sin(frame * 0.05) * 0.5;
      mask.scaleY = mask.scaleX;

      ++frame;
    });

    const sprite = new Sprite({
      context: this.context,
      image: back,
      mask,
      x: this.context.app.width / 2,
      y: this.context.app.height / 2,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this.addChild(sprite);
  }
}
