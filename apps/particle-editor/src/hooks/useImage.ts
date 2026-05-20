import { Rectangle } from '@rutan/midorable';
import { atom, useAtom } from 'jotai';

export type TextureSourceMode = 'single' | 'pack';

const imageUrlAtom = atom<string | null>(null);
const imageFramesAtom = atom<Rectangle[]>([]);
const managedObjectUrlAtom = atom<string | null>(null);
const textureSourceModeAtom = atom<TextureSourceMode>('single');

export function useImage() {
  const [imageUrl, setImageUrl] = useAtom(imageUrlAtom);
  const [imageFrames, setImageFrames] = useAtom(imageFramesAtom);
  const [managedObjectUrl, setManagedObjectUrl] = useAtom(managedObjectUrlAtom);
  const [textureSourceMode, setTextureSourceMode] = useAtom(textureSourceModeAtom);

  const releaseManagedObjectUrl = () => {
    if (!managedObjectUrl) return;
    URL.revokeObjectURL(managedObjectUrl);
    setManagedObjectUrl(null);
  };

  const clearImage = () => {
    releaseManagedObjectUrl();
    setImageUrl(null);
    setImageFrames([]);
  };

  const setImageFromFile = (file: File) => {
    releaseManagedObjectUrl();
    const nextObjectUrl = URL.createObjectURL(file);
    setManagedObjectUrl(nextObjectUrl);
    setImageUrl(nextObjectUrl);
    setImageFrames([]);
    setTextureSourceMode('single');
  };

  const setTextureFromFile = (file: File, frames: Rectangle[]) => {
    releaseManagedObjectUrl();
    const nextObjectUrl = URL.createObjectURL(file);
    setManagedObjectUrl(nextObjectUrl);
    setImageUrl(nextObjectUrl);
    setImageFrames(frames);
    setTextureSourceMode('pack');
  };

  const replaceImageUrl = (nextImageUrl: string | null) => {
    releaseManagedObjectUrl();
    setImageUrl(nextImageUrl);
    setImageFrames([]);
  };

  return {
    imageUrl,
    setImageUrl: replaceImageUrl,
    setImageFromFile,
    setTextureFromFile,
    clearImage,
    imageFrames,
    setImageFrames,
    textureSourceMode,
    setTextureSourceMode,
  };
}
