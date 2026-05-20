import { audioAsset, DisplayObject, type DisplayObjectProps } from '@rutan/midorable';
import { sceneRouter, type AssetsOf } from '../_share';
import { AudioPlayerSprite } from './AudioPlayerSprite';

const audioSceneAssets = sceneRouter.defineAssets('audio', () => ({
  bgmAudio: audioAsset('audio/sample-bgm.mp3'),
  seAudio: audioAsset('audio/sample-se.mp3'),
}));

type AudioSceneAssets = AssetsOf<typeof audioSceneAssets>;

export const AudioSceneDef = sceneRouter.defineScene('audio', {
  getAssets: audioSceneAssets,
  create({ context, assets }) {
    return new AudioSceneView({ context, assets });
  },
});

export interface AudioSceneViewProps extends DisplayObjectProps {
  assets: AudioSceneAssets;
}

export class AudioSceneView extends DisplayObject {
  constructor(props: AudioSceneViewProps) {
    super(props);

    const { bgmAudio, seAudio } = props.assets;

    const audioPlayerSprite = new AudioPlayerSprite({
      context: this.context,
      name: 'BGM',
      audio: bgmAudio,
      loop: true,
      x: 360,
      y: 130,
    });
    this.addChild(audioPlayerSprite);

    const sePlayerSprite = new AudioPlayerSprite({
      context: this.context,
      name: 'SE',
      audio: seAudio,
      x: 360,
      y: 400,
    });
    this.addChild(sePlayerSprite);
  }
}
