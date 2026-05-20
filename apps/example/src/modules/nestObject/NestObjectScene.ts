import { DisplayObject, type DisplayObjectProps, Sprite } from '@rutan/midorable';
import { sceneRouter } from '../_share';

export const NestObjectSceneDef = sceneRouter.defineScene('nestObject', {
  create({ context }) {
    return new NestObjectSceneView({ context });
  },
});

export class NestObjectSceneView extends DisplayObject {
  constructor(props: DisplayObjectProps) {
    super(props);

    const texture = this.context.app.createTexture(100, 100);
    texture.drawRect({
      x: 0,
      y: 0,
      width: texture.width,
      height: texture.height,
      color: { r: 255, g: 255, b: 255, a: 1 },
    });

    const parent = new Sprite({
      context: this.context,
      image: texture,
      x: this.context.app.width / 2,
      y: this.context.app.height / 2,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: 2,
      scaleY: 2,
    });
    this.addChild(parent);
    parent.onUpdate.on(() => {
      parent.rotation += 0.01;
    });

    const child1 = new Sprite({
      context: this.context,
      image: texture,
      colorTone: { r: 255, g: 0, b: 0, a: 1 },
      scaleX: 0.5,
      scaleY: 0.5,
    });
    parent.addChild(child1);

    const child2 = new Sprite({
      context: this.context,
      image: texture,
      colorTone: { r: 0, g: 255, b: 0, a: 1 },
      x: -50,
      rotation: Math.PI / 4,
      opacity: 0.5,
    });
    parent.addChild(child2);
    child2.onUpdate.on(() => {
      child2.rotation += 0.02;
    });

    const grandChild2_1 = new Sprite({
      context: this.context,
      image: texture,
      colorTone: { r: 0, g: 0, b: 255, a: 1 },
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: 0.2,
      scaleY: 0.4,
    });
    child2.addChild(grandChild2_1);
  }
}
