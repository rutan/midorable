import { DisplayObject, type DisplayObjectProps } from '@rutan/midorable';
import { sceneRouter } from '../_share';
import { LoadSprite } from './LoadSprite';

export const LoaderSceneDef = sceneRouter.defineScene('loader', {
  create({ context }) {
    return new LoaderSceneView({ context });
  },
});

export class LoaderSceneView extends DisplayObject {
  constructor(props: DisplayObjectProps) {
    super(props);

    LOAD_EXAMPLE.forEach((props, index) => {
      const loadSprite = new LoadSprite({
        context: this.context,
        type: props.type,
        key: props.key,
        url: props.url,
        x: 360,
        y: 180 + index * 100,
      });
      this.addChild(loadSprite);
    });
  }
}

const LOAD_EXAMPLE = [
  {
    type: 'image',
    key: 'sample-image',
    url: 'img/image_pixel.png',
  },
  {
    type: 'audio',
    key: 'sample-audio',
    url: 'audio/sample-se.mp3',
  },
  {
    type: 'text',
    key: 'sample-text',
    url: 'data/sample.txt',
  },
  {
    type: 'binary',
    key: 'sample-binary',
    url: 'img/image_pixel.png',
  },
] as const;
