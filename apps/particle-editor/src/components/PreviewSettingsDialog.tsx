import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react';
import { useMemo } from 'react';
import type { PreviewSettings } from '../hooks';

export function PreviewSettingsDialog({
  open,
  draft,
  onChange,
  onClose,
  onSave,
  onReset,
}: {
  open: boolean;
  draft: PreviewSettings;
  onChange: (next: PreviewSettings) => void;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const backgroundHex = useMemo(() => colorToHex(draft.backgroundColor), [draft.backgroundColor]);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-slate-900/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded border border-slate-300 bg-white p-4 shadow-xl">
          <DialogTitle className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            <SlidersHorizontal size={16} />
            プレビュー設定
          </DialogTitle>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <NumberField
              label="幅"
              value={draft.width}
              min={1}
              step={1}
              onChange={(value) => onChange({ ...draft, width: value })}
            />
            <NumberField
              label="高さ"
              value={draft.height}
              min={1}
              step={1}
              onChange={(value) => onChange({ ...draft, height: value })}
            />
            <NumberField
              label="FPS"
              value={draft.fps}
              min={1}
              step={1}
              onChange={(value) => onChange({ ...draft, fps: value })}
            />
            <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-sm">
              <span>背景色</span>
              <input
                className="h-9 w-full rounded border border-slate-300 bg-white px-1"
                type="color"
                value={backgroundHex}
                onChange={(event) => onChange({ ...draft, backgroundColor: hexToColor(event.target.value) })}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              className="mr-auto inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-200"
              type="button"
              onClick={onReset}
            >
              <RotateCcw size={14} />
              デフォルト設定に戻す
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-200"
              type="button"
              onClick={onClose}
            >
              <X size={14} />
              キャンセル
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded bg-slate-700 px-3 py-2 text-sm text-white cursor-pointer hover:bg-slate-800"
              type="button"
              onClick={onSave}
            >
              <Save size={14} />
              保存
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-sm">
      <span>{label}</span>
      <input
        className="rounded border border-slate-300 bg-white px-2 py-1"
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) onChange(nextValue);
        }}
      />
    </label>
  );
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toHexByte(value: number) {
  return value.toString(16).padStart(2, '0');
}

function colorToHex(color: { r: number; g: number; b: number }) {
  return `#${toHexByte(clampInteger(color.r, 0, 255))}${toHexByte(clampInteger(color.g, 0, 255))}${toHexByte(clampInteger(color.b, 0, 255))}`;
}

function hexToColor(hex: string) {
  const normalized = /^#?[0-9a-fA-F]{6}$/.test(hex) ? hex.replace('#', '') : '000000';
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return { r, g, b, a: 1 };
}
