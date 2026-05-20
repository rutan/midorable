import {
  DisplayObject,
  type DisplayObjectProps,
  imageAsset,
  ParticleEmitter,
  ParticleEmitterConfig,
} from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';

const particleSceneAssets = sceneRouter.defineAssets('particle', () => ({
  image: imageAsset('img/particle_circle.png'),
}));

type ParticleSceneAssets = AssetsOf<typeof particleSceneAssets>;

export const ParticleSceneDef = sceneRouter.defineScene('particle', {
  getAssets: particleSceneAssets,
  create({ context, assets }) {
    return new ParticleSceneView({ context, assets });
  },
});

export interface ParticleSceneViewProps extends DisplayObjectProps {
  assets: ParticleSceneAssets;
}

export class ParticleSceneView extends DisplayObject {
  constructor(props: ParticleSceneViewProps) {
    super(props);

    const { image } = props.assets;

    const particleSprite = new ParticleEmitter({
      context: this._context,
      config: PARTICLE_EXAMPLE,
      image,
    });
    this.addChild(particleSprite);
    particleSprite.play();

    particleSprite.onUpdate.on(() => {
      const pointer = this._context.app.input.pointers[0];
      if (pointer) {
        particleSprite.baseX = pointer.x;
        particleSprite.baseY = pointer.y;
      } else {
        particleSprite.baseX = this._context.app.width / 2;
        particleSprite.baseY = this._context.app.height / 2;
      }
    });
  }
}

const PARTICLE_EXAMPLE: ParticleEmitterConfig = {
  duration: -1,
  spawn: {
    type: 'point',
    x: 0,
    y: 0,
  },
  emissionRate: 30,
  burstCount: 3,
  lifetime: {
    min: 0.35,
    max: 0.55,
  },
  speed: {
    min: 300,
    max: 500,
  },
  direction: {
    min: 0,
    max: 360,
  },
  scale: {
    min: 0.2,
    max: 1,
  },
  alpha: 1,
  alphaOverLife: {
    keys: [
      {
        t: 0,
        v: 0,
      },
      {
        t: 0.5056103815753104,
        v: 1,
      },
      {
        t: 1,
        v: 0,
      },
    ],
  },
  blendMode: 'add',
  alignToDirection: false,
  forces: [],
  speedOverLife: {
    keys: [
      {
        t: 0,
        v: 1,
      },
      {
        t: 0.2699752114852966,
        v: 0.9270834922790527,
      },
      {
        t: 0.509350564619432,
        v: 0.8020834922790527,
      },
      {
        t: 0.7636869495556123,
        v: 0.4687495231628418,
      },
      {
        t: 1,
        v: 0,
      },
    ],
  },
  color: {
    start: {
      r: 255,
      g: 0,
      b: 0,
      a: 0.5,
    },
    end: {
      r: 0,
      g: 0,
      b: 255,
      a: 0.5,
    },
  },
};
