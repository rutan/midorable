import { DisplayObject, type DisplayObjectProps, imageAsset, Sprite, type SpriteProps } from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';

const colorSceneAssets = sceneRouter.defineAssets('color', () => ({
  back: imageAsset('img/back.jpg'),
  image: imageAsset('img/image_pixel.png'),
}));

type ColorSceneAssets = AssetsOf<typeof colorSceneAssets>;

export const ColorSceneDef = sceneRouter.defineScene('color', {
  getAssets: colorSceneAssets,
  create({ context, assets }) {
    return new ColorSceneView({ context, assets });
  },
});

export interface ColorSceneViewProps extends DisplayObjectProps {
  assets: ColorSceneAssets;
}

export class ColorSceneView extends DisplayObject {
  constructor(props: ColorSceneViewProps) {
    super(props);

    const { back, image } = props.assets;

    const backSprite = new Sprite({
      context: this.context,
      image: back,
      x: this.context.app.width / 2,
      y: this.context.app.height / 2,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this.addChild(backSprite);

    (
      [
        {
          colorTone: { r: 255, g: 0, b: 0, a: 1 },
        },
        {
          colorTone: { r: 0, g: 255, b: 0, a: 0.6 },
        },
        {
          colorTone: { r: 0, g: 0, b: 0, a: 0.3 },
        },
        {
          blendMode: 'add',
        },
        {
          blendMode: 'subtract',
        },
        {
          blendMode: 'add',
          colorTone: { r: 0, g: 0, b: 255, a: 0.5 },
        },
      ] satisfies Partial<SpriteProps>[]
    ).forEach((props, i) => {
      const sprite = new Sprite({
        context: this.context,
        image,
        x: this.context.app.width / 2 + ((i % 3) - 1) * 200,
        y: this.context.app.height / 2 + (Math.floor(i / 3) - 0.5) * 200,
        anchorX: 0.5,
        anchorY: 0.5,
        ...props,
      });
      this.addChild(sprite);
    });
  }
}
