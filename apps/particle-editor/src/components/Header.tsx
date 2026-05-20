import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Download, Menu as MenuIcon, RotateCcw, Settings2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  createDefaultParticleEmitterConfig,
  createDefaultPreviewSettings,
  useImage,
  useParticleEmitterConfig,
  usePreviewSettings,
} from '../hooks';
import { validateParticleEmitterConfig } from '../typia';
import { cx, generateTypiaErrorMessage } from '../utils';
import { PreviewSettingsDialog } from './PreviewSettingsDialog';

export const Header = () => {
  const { config, setConfig } = useParticleEmitterConfig();
  const { clearImage } = useImage();
  const { previewSettings, setPreviewSettings } = usePreviewSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewSettingsOpen, setIsPreviewSettingsOpen] = useState(false);
  const [draftPreviewSettings, setDraftPreviewSettings] = useState(previewSettings);

  const handleExport = () => {
    const exportData = config;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'particle-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = validateParticleEmitterConfig(parsed);
      if (!result.success) {
        window.alert(`設定ファイルの形式が不正です: ${generateTypiaErrorMessage(result.errors)}`);
        return;
      }
      setConfig(result.data);
    } catch {
      window.alert('設定ファイルの読み込みに失敗しました。');
    }
  };

  const handleReset = () => {
    const ok = window.confirm('現在の設定を初期値に戻します。よろしいですか？');
    if (!ok) return;
    setConfig(createDefaultParticleEmitterConfig());
    clearImage();
  };

  const openPreviewSettings = () => {
    setDraftPreviewSettings(previewSettings);
    setIsPreviewSettingsOpen(true);
  };

  const closePreviewSettings = () => {
    setIsPreviewSettingsOpen(false);
  };

  const savePreviewSettings = () => {
    setPreviewSettings({
      ...draftPreviewSettings,
      width: clampInteger(draftPreviewSettings.width, 1, 4096),
      height: clampInteger(draftPreviewSettings.height, 1, 4096),
      fps: clampInteger(draftPreviewSettings.fps, 1, 240),
    });
    setIsPreviewSettingsOpen(false);
  };

  return (
    <header
      className={cx(
        'Header',
        'flex h-12 w-full items-center justify-between border-b border-slate-300 bg-slate-200 px-3',
      )}
    >
      <h1 className="text-md font-semibold text-slate-800">Midorable Particle Editor</h1>
      <div className="h-full">
        <Menu>
          <MenuButton className="flex px-4 h-full items-center align-middle gap-2 hover:bg-slate-300 rounded text-slate-700 cursor-pointer">
            <MenuIcon size={14} />
            メニュー
          </MenuButton>
          <MenuItems
            anchor="bottom end"
            className="mt-2 w-44 rounded border border-slate-300 bg-white p-1 text-sm shadow-md focus:outline-none"
          >
            <MenuItem>
              <MenuItemButton onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                インポート
              </MenuItemButton>
            </MenuItem>
            <MenuItem>
              <MenuItemButton onClick={handleExport}>
                <Download size={14} />
                エクスポート
              </MenuItemButton>
            </MenuItem>
            <MenuItem>
              <MenuItemButton onClick={openPreviewSettings}>
                <Settings2 size={14} />
                プレビュー設定
              </MenuItemButton>
            </MenuItem>
            <MenuItem>
              <MenuItemButton mode="danger" onClick={handleReset}>
                <RotateCcw size={14} />
                リセット
              </MenuItemButton>
            </MenuItem>
          </MenuItems>
        </Menu>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            void handleImportFile(file);
          }}
        />
      </div>
      <PreviewSettingsDialog
        open={isPreviewSettingsOpen}
        draft={draftPreviewSettings}
        onChange={setDraftPreviewSettings}
        onClose={closePreviewSettings}
        onSave={savePreviewSettings}
        onReset={() => setDraftPreviewSettings(createDefaultPreviewSettings())}
      />
    </header>
  );
};

const MenuItemButton = ({
  type = 'button',
  mode = 'normal',
  className,
  onClick,
  children,
  ...props
}: {
  type?: 'button' | 'submit' | 'reset';
  mode?: 'normal' | 'danger';
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) => (
  <button
    className={cx(
      'inline-flex w-full items-center gap-2 rounded p-2 text-left',
      mode === 'normal' ? 'text-slate-700 data-[focus]:bg-slate-100' : 'text-red-700 data-[focus]:bg-red-50',
      className,
    )}
    type={type}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
