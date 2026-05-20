import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { Rectangle } from '@rutan/midorable';
import { CheckSquare, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useImage, useTexturePack } from '../hooks';
import { cx, generateTypiaErrorMessage } from '../utils';
import { parseTexturePackFrames } from '../utils';
import { Section } from './EditorFields';

export function TextureTab({
  imageUrl,
  imageFrames,
  onSelectFile,
  onApplyTexturePack,
  onClear,
}: {
  imageUrl: string | null;
  imageFrames: Rectangle[];
  onSelectFile: (file: File) => void;
  onApplyTexturePack: (file: File, frames: Rectangle[]) => void;
  onClear: () => void;
}) {
  const { textureSourceMode, setTextureSourceMode } = useImage();
  const {
    packManifest,
    setPackManifest,
    packImage,
    setPackImage,
    selectedFrameNames,
    setSelectedFrameNames,
    singleImageFile,
    setSingleImageFile,
    clearTexturePackState,
  } = useTexturePack();
  const [packPreviewUrl, setPackPreviewUrl] = useState<string | null>(null);
  const onSelectFileRef = useRef(onSelectFile);
  const onApplyTexturePackRef = useRef(onApplyTexturePack);

  const targetFrames = useMemo(() => {
    if (!packManifest) return [];
    return packManifest.frames;
  }, [packManifest]);

  const allFrameNames = useMemo(() => targetFrames.map((frame) => frame.name), [targetFrames]);
  const selectedFrameSet = useMemo(() => new Set(selectedFrameNames), [selectedFrameNames]);

  const selectedFrames = useMemo(
    () => targetFrames.filter((frame) => selectedFrameSet.has(frame.name)).map((frame) => frame.frame),
    [targetFrames, selectedFrameSet],
  );

  const resolvedPackImage = useMemo(() => {
    if (!packManifest) return null;
    return packImage;
  }, [packImage, packManifest]);

  const sourceModeIndex = textureSourceMode === 'single' ? 0 : 1;
  const canApplyPack = Boolean(packManifest && resolvedPackImage && selectedFrames.length > 0);
  const canClearPack = Boolean(packManifest || packImage);

  useEffect(() => {
    onSelectFileRef.current = onSelectFile;
    onApplyTexturePackRef.current = onApplyTexturePack;
  }, [onApplyTexturePack, onSelectFile]);

  useEffect(() => {
    if (!resolvedPackImage) {
      setPackPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(resolvedPackImage);
    setPackPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [resolvedPackImage]);

  useEffect(() => {
    if (textureSourceMode !== 'single') return;
    if (!singleImageFile) return;
    onSelectFileRef.current(singleImageFile);
  }, [singleImageFile, textureSourceMode]);

  useEffect(() => {
    if (textureSourceMode !== 'pack') return;
    if (!canApplyPack || !resolvedPackImage || selectedFrames.length === 0) return;
    onApplyTexturePackRef.current(resolvedPackImage, selectedFrames);
  }, [canApplyPack, resolvedPackImage, selectedFrames, textureSourceMode]);

  const handlePackJsonSelect = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = parseTexturePackFrames(parsed);
      if (!result.success) {
        alert(`パックJSONの解析に失敗しました: ${generateTypiaErrorMessage(result.errors)}`);
        setPackManifest(null);
        setSelectedFrameNames([]);
        return;
      }
      setPackManifest(result.data);
      setSelectedFrameNames(result.data.frames.map((frame) => frame.name));
    } catch {
      setPackManifest(null);
      setSelectedFrameNames([]);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="テクスチャソース">
        <TabGroup
          selectedIndex={sourceModeIndex}
          onChange={(index) => setTextureSourceMode(index === 0 ? 'single' : 'pack')}
          className="space-y-3"
        >
          <TabList className="grid grid-cols-2 gap-2">
            <Tab className={sourceModeTabClassName}>単一画像</Tab>
            <Tab className={sourceModeTabClassName}>テクスチャパック</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <div className="grid grid-cols-1 gap-2">
                <label className="text-sm text-slate-700">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <Upload size={14} />
                    画像ファイル
                  </span>
                  <input
                    className="block w-full rounded border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) return;
                      setSingleImageFile(file);
                    }}
                  />
                </label>
                {imageUrl && imageFrames.length === 0 ? (
                  <>
                    <div className="overflow-hidden rounded border border-slate-300 bg-white p-2">
                      <img src={imageUrl} alt="texture preview" className="max-h-48 w-auto object-contain" />
                    </div>
                    <button
                      className={dangerActionButtonClassName}
                      type="button"
                      onClick={() => {
                        setSingleImageFile(null);
                        onClear();
                      }}
                    >
                      <Trash2 size={14} />
                      画像をクリア
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">単一画像は未設定です。</p>
                )}
              </div>
            </TabPanel>
            <TabPanel>
              <div className="grid grid-cols-1 gap-3">
                <label className="text-sm text-slate-700">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <Upload size={14} />
                    パックJSON
                  </span>
                  <input
                    className="block w-full rounded border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) return;
                      void handlePackJsonSelect(file);
                    }}
                  />
                </label>

                <label className="text-sm text-slate-700">
                  <span className="mb-1 inline-flex items-center gap-1.5">
                    <Upload size={14} />
                    パック画像
                  </span>
                  <input
                    className="block w-full rounded border border-slate-300 bg-white text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-slate-800"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.currentTarget.value = '';
                      setPackImage(file);
                    }}
                  />
                </label>

                {packManifest ? (
                  <div className="rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
                    <p>images: {packManifest.image}</p>
                    <p>frames: {packManifest.frames.length} 件</p>
                    {!resolvedPackImage && (
                      <p className="mt-1 text-red-700">
                        必要な画像ファイルが見つかりません。画像入力を確認してください。
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">パックJSONが未設定です。</p>
                )}

                {targetFrames.length > 0 && (
                  <div className="space-y-2 rounded border border-slate-300 bg-white p-2">
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white"
                        type="button"
                        onClick={() => setSelectedFrameNames(allFrameNames)}
                      >
                        <CheckSquare size={12} />
                        全選択
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white"
                        type="button"
                        onClick={() => setSelectedFrameNames([])}
                      >
                        <Square size={12} />
                        全解除
                      </button>
                    </div>

                    <div className="max-h-48 space-y-1 overflow-auto">
                      {targetFrames.map((frame) => (
                        <label
                          key={frame.name}
                          className="flex items-center gap-2 rounded border border-slate-200 p-1 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFrameSet.has(frame.name)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedFrameNames((previous) =>
                                  previous.includes(frame.name) ? previous : [...previous, frame.name],
                                );
                              } else {
                                setSelectedFrameNames((previous) => previous.filter((name) => name !== frame.name));
                              }
                            }}
                          />
                          <FrameThumbnail imageUrl={packPreviewUrl} frame={frame.frame} />
                          <span className="min-w-0 flex-1 truncate">{frame.name}</span>
                          <span className="text-slate-500">
                            {frame.frame.width}x{frame.frame.height}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {canClearPack && (
                  <button
                    className={dangerActionButtonClassName}
                    type="button"
                    onClick={() => {
                      clearTexturePackState();
                      if (textureSourceMode === 'pack') {
                        onClear();
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    パックをクリア
                  </button>
                )}
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Section>
    </div>
  );
}

function sourceModeTabClassName({ selected }: { selected: boolean }) {
  return cx(
    'rounded border px-3 py-1.5 text-sm',
    selected
      ? 'border-slate-700 bg-slate-700 text-white'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  );
}

const dangerActionButtonClassName =
  'inline-flex w-fit items-center gap-1.5 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800';

function FrameThumbnail({ imageUrl, frame }: { imageUrl: string | null; frame: Rectangle }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setThumbnailUrl(null);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = Math.min(size / frame.width, size / frame.height);
      const drawWidth = frame.width * scale;
      const drawHeight = frame.height * scale;
      const offsetX = (size - drawWidth) * 0.5;
      const offsetY = (size - drawHeight) * 0.5;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, offsetX, offsetY, drawWidth, drawHeight);
      setThumbnailUrl(canvas.toDataURL());
    };
    image.src = imageUrl;
  }, [imageUrl, frame.x, frame.y, frame.width, frame.height]);

  return thumbnailUrl ? (
    <img src={thumbnailUrl} alt="" className="h-8 w-8 rounded border border-slate-200 bg-slate-100 object-contain" />
  ) : (
    <div className="h-8 w-8 rounded border border-slate-200 bg-slate-100" />
  );
}
