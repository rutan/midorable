import { describe, expect, it, vi } from 'vitest';
import { audioAsset, binaryAsset, imageAsset, textAsset } from '../../src/core/asset';
import { Loader } from '../../src/core/Loader';
import {
  createAudioAsset,
  createBinaryAsset,
  createImageAsset,
  createMockPlatform,
  createTextAsset,
} from '../helpers/createMockPlatform';

describe('Loader unload', () => {
  it('unloads by asset instance and removes cache entry', async () => {
    const { platform } = createMockPlatform();
    const image = createImageAsset('image');
    platform.loadAsset = vi.fn(async () => image);
    const loader = new Loader(platform);
    await loader.load(imageAsset('/image.png'), { key: 'image' });

    expect(loader.get('image')).toBe(image);
    await loader.unload(image);

    expect(loader.get('image')).toBeUndefined();
    expect(platform.unloadAsset).toHaveBeenCalledTimes(1);
    expect(platform.unloadAsset).toHaveBeenCalledWith(image);
  });

  it('unloadAllAssets unloads all asset types', async () => {
    const { platform } = createMockPlatform();
    const image = createImageAsset('image');
    const audio = createAudioAsset('audio');
    const text = createTextAsset('text', 'hello');
    const binary = createBinaryAsset('binary');
    platform.loadAsset = vi.fn(async (spec) => {
      switch (spec.type) {
        case 'image':
          return image;
        case 'audio':
          return audio;
        case 'text':
          return text;
        case 'binary':
          return binary;
        default:
          throw new Error('unexpected asset type');
      }
    });
    const loader = new Loader(platform);
    await loader.load(imageAsset('/image.png'), { key: 'image' });
    await loader.load(audioAsset('/audio.ogg'), { key: 'audio' });
    await loader.load(textAsset('/text.txt'), { key: 'text' });
    await loader.load(binaryAsset('/data.bin'), { key: 'binary' });

    await loader.unloadAllAssets();

    expect(loader.get('image')).toBeUndefined();
    expect(loader.get('audio')).toBeUndefined();
    expect(loader.get('text')).toBeUndefined();
    expect(loader.get('binary')).toBeUndefined();
    expect(platform.unloadAsset).toHaveBeenCalledTimes(4);
    expect(platform.unloadAsset).toHaveBeenNthCalledWith(1, image);
    expect(platform.unloadAsset).toHaveBeenNthCalledWith(2, audio);
    expect(platform.unloadAsset).toHaveBeenNthCalledWith(3, text);
    expect(platform.unloadAsset).toHaveBeenNthCalledWith(4, binary);
  });

  it('dispose unloads cached assets once and prevents further loads', async () => {
    const { platform } = createMockPlatform();
    const image = createImageAsset('image');
    platform.loadAsset = vi.fn(async () => image);
    const onDispose = vi.fn();
    const loader = new Loader(platform, { onDispose });
    await loader.load(imageAsset('/image.png'), { key: 'image' });

    await loader.dispose();
    await loader.dispose();

    expect(loader.disposed).toBe(true);
    expect(platform.unloadAsset).toHaveBeenCalledTimes(1);
    expect(platform.unloadAsset).toHaveBeenCalledWith(image);
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(() => loader.get('image')).toThrow('Loader has been disposed');
    expect(() => loader.load(imageAsset('/again.png'))).toThrow('Loader has been disposed');
  });
});
