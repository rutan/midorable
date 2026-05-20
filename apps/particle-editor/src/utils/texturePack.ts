import { Rectangle } from '@rutan/midorable';
import { validateTexturePackManifest } from '../typia';

export interface TexturePackFrame {
  name: string;
  frame: Rectangle;
}

export interface TexturePackManifest {
  image: string;
  frames: TexturePackFrame[];
}

export function parseTexturePackFrames(input: unknown) {
  const result = validateTexturePackManifest(input);
  if (!result.success) return result;

  const { image, frames } = result.data;
  const packFrames: TexturePackFrame[] = [];
  for (const [name, frame] of Object.entries(frames)) {
    packFrames.push({ name, frame });
  }

  return {
    success: true,
    data: {
      image,
      frames: packFrames,
    },
  } as const;
}
