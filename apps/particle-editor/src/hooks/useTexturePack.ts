import { atom, useAtom } from 'jotai';
import { TexturePackManifest } from '../utils';

const packManifestAtom = atom<TexturePackManifest | null>(null);
const packImageAtom = atom<File | null>(null);
const selectedFrameNamesAtom = atom<string[]>([]);
const singleImageFileAtom = atom<File | null>(null);

export function useTexturePack() {
  const [packManifest, setPackManifest] = useAtom(packManifestAtom);
  const [packImage, setPackImage] = useAtom(packImageAtom);
  const [selectedFrameNames, setSelectedFrameNames] = useAtom(selectedFrameNamesAtom);
  const [singleImageFile, setSingleImageFile] = useAtom(singleImageFileAtom);

  const clearTexturePackState = () => {
    setPackManifest(null);
    setPackImage(null);
    setSelectedFrameNames([]);
    setSingleImageFile(null);
  };

  return {
    packManifest,
    setPackManifest,
    packImage,
    setPackImage,
    selectedFrameNames,
    setSelectedFrameNames,
    singleImageFile,
    setSingleImageFile,
    clearTexturePackState,
  };
}
