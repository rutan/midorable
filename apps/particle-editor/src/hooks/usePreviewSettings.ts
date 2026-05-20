import { Color } from '@rutan/midorable';
import { atom, useAtom } from 'jotai';

export interface PreviewSettings {
  width: number;
  height: number;
  fps: number;
  backgroundColor: Color;
}

export function createDefaultPreviewSettings(): PreviewSettings {
  return {
    width: 960,
    height: 540,
    fps: 60,
    backgroundColor: { r: 0, g: 0, b: 0, a: 1 },
  };
}

const previewSettingsAtom = atom<PreviewSettings>(createDefaultPreviewSettings());

export function usePreviewSettings() {
  const [previewSettings, setPreviewSettings] = useAtom(previewSettingsAtom);

  return {
    previewSettings,
    setPreviewSettings,
  };
}
