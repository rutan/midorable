import { DisplayObject, type DisplayObjectProps, type ImageAsset, NinePatch } from '@rutan/midorable';
import { BUTTON_CORNER_SIZE, BUTTON_IMAGE_KEY, sceneRouter } from '../_share';

export const NinePatchSceneDef = sceneRouter.defineScene('ninePatch', {
  create({ context }) {
    return new NinePatchSceneView({ context });
  },
});

export class NinePatchSceneView extends DisplayObject {
  constructor(props: DisplayObjectProps) {
    super(props);

    const image = this.context.loader.get(BUTTON_IMAGE_KEY)! as ImageAsset;

    const sprite = new NinePatch({
      context: this.context,
      image: image,
      slice: {
        left: BUTTON_CORNER_SIZE,
        top: BUTTON_CORNER_SIZE,
        right: BUTTON_CORNER_SIZE,
        bottom: BUTTON_CORNER_SIZE,
      },
      width: 200,
      height: 200,
      x: 100,
      y: 100,
    });

    let frameCount = 0;
    sprite.onUpdate.on(() => {
      sprite.width = 400 + Math.sin(frameCount * 0.1) * 120;
      sprite.height = 200 + Math.cos(frameCount * 0.1) * 120;

      frameCount++;
    });
    this.addChild(sprite);
  }
}
