import { Curve, ScalarValue } from '@rutan/midorable';
import { CircleDot, CirclePlus, SlidersHorizontal, Trash } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../utils';

export function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-slate-300 bg-white p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-sm">
      <span>{label}</span>
      <input
        className="rounded border border-slate-300 bg-white px-2 py-1 disabled:opacity-60"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </label>
  );
}

export function ScalarField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  children,
}: {
  label: string;
  value: ScalarValue;
  onChange: (value: ScalarValue) => void;
  min?: number;
  max?: number;
  step?: number;
  children?: React.ReactNode | React.ReactNode[];
}) {
  return (
    <ScalarFieldCard
      header={<span className="text-sm font-medium">{label}</span>}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
    >
      {children}
    </ScalarFieldCard>
  );
}

export function OptionalScalarField({
  label,
  enabled,
  value,
  onEnabledChange,
  onChange,
  min,
  max,
  step,
  children,
}: {
  label: string;
  enabled: boolean;
  value: ScalarValue;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: ScalarValue) => void;
  min?: number;
  max?: number;
  step?: number;
  children?: React.ReactNode | React.ReactNode[];
}) {
  return (
    <ScalarFieldCard
      header={
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
          {label}
        </label>
      }
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      controlsDisabled={!enabled}
      controlsVisible={enabled}
      contentVisible={enabled}
    >
      {children}
    </ScalarFieldCard>
  );
}

function ScalarFieldCard({
  header,
  value,
  onChange,
  min,
  max,
  step,
  controlsDisabled,
  controlsVisible,
  contentVisible,
  children,
}: {
  header: React.ReactNode;
  value: ScalarValue;
  onChange: (value: ScalarValue) => void;
  min?: number;
  max?: number;
  step?: number;
  controlsDisabled?: boolean;
  controlsVisible?: boolean;
  contentVisible?: boolean;
  children?: React.ReactNode | React.ReactNode[];
}) {
  const isRange = typeof value !== 'number';
  const showContent = contentVisible ?? true;
  const showControls = controlsVisible ?? true;

  return (
    <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center justify-between gap-2">
        {header}
        {showControls && (
          <button
            className="rounded p-1 text-xs disabled:opacity-60 cursor-pointer hover:bg-slate-200"
            type="button"
            disabled={controlsDisabled}
            onClick={() => {
              if (isRange) {
                onChange(value.min);
              } else {
                onChange({ min: value, max: value });
              }
            }}
            aria-label={isRange ? '単一値にする' : '範囲にする'}
          >
            {isRange ? <CircleDot size={14} aria-hidden="true" /> : <SlidersHorizontal size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
      {showContent && (
        <>
          <ScalarValueInputs value={value} onChange={onChange} min={min} max={max} step={step} />
          {children}
        </>
      )}
    </div>
  );
}

function ScalarValueInputs({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: ScalarValue;
  onChange: (value: ScalarValue) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  if (typeof value !== 'number') {
    return (
      <div className="grid grid-cols-1 gap-2">
        <NumberField
          label="Min"
          value={value.min}
          min={min}
          max={max}
          step={step}
          onChange={(nextValue) => onChange({ ...value, min: nextValue })}
        />
        <NumberField
          label="Max"
          value={value.max}
          min={min}
          max={max}
          step={step}
          onChange={(nextValue) => onChange({ ...value, max: nextValue })}
        />
      </div>
    );
  }

  return <NumberField label="Value" value={value} min={min} max={max} step={step} onChange={onChange} />;
}

export function CurveField({ value, onChange }: { value: Curve; onChange: (value: Curve) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const keys = useMemo(() => normalizeCurveKeys(value.keys), [value.keys]);
  const yBounds = { min: 0, max: 1 };

  const graph = {
    width: 320,
    height: 140,
    padding: 14,
  };

  const toPoint = (t: number, v: number) => {
    const innerWidth = graph.width - graph.padding * 2;
    const innerHeight = graph.height - graph.padding * 2;
    const x = graph.padding + clampNumber(t, 0, 1) * innerWidth;
    const y =
      graph.height -
      graph.padding -
      ((clampNumber(v, yBounds.min, yBounds.max) - yBounds.min) / (yBounds.max - yBounds.min)) * innerHeight;
    return { x, y };
  };

  const updateKeys = (nextKeys: Curve['keys']) => {
    onChange({ keys: normalizeCurveKeys(nextKeys) });
  };

  const updateKeyAt = (index: number, next: { t?: number; v?: number }) => {
    const previous = keys[index];
    if (!previous) return;

    const isEdgeKey = index === 0 || index === keys.length - 1;
    const previousNeighborT = index > 0 ? keys[index - 1].t + 0.001 : 0;
    const nextNeighborT = index < keys.length - 1 ? keys[index + 1].t - 0.001 : 1;
    const nextT = isEdgeKey
      ? index === 0
        ? 0
        : 1
      : typeof next.t === 'number'
        ? clampNumber(next.t, previousNeighborT, nextNeighborT)
        : previous.t;
    const nextV = typeof next.v === 'number' ? clampNumber(next.v, yBounds.min, yBounds.max) : previous.v;

    updateKeys(keys.map((key, keyIndex) => (keyIndex === index ? { t: nextT, v: nextV } : key)));
  };

  const updateByPointer = (clientX: number, clientY: number) => {
    if (activeIndex === null || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((clientX - rect.left) / rect.width) * graph.width;
    const y = ((clientY - rect.top) / rect.height) * graph.height;

    const innerWidth = graph.width - graph.padding * 2;
    const innerHeight = graph.height - graph.padding * 2;
    const t = clampNumber((x - graph.padding) / innerWidth, 0, 1);
    const v = yBounds.max - clampNumber((y - graph.padding) / innerHeight, 0, 1) * (yBounds.max - yBounds.min);
    const isEdgeKey = activeIndex === 0 || activeIndex === keys.length - 1;

    updateKeyAt(activeIndex, isEdgeKey ? { v } : { t, v });
  };

  useEffect(() => {
    if (activeIndex === null) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateByPointer(event.clientX, event.clientY);
    };
    const handlePointerEnd = () => {
      setActiveIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [activeIndex, keys, yBounds.max, yBounds.min]);

  const linePath = keys
    .map((key, index) => {
      const point = toPoint(key.t, key.v);
      return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    })
    .join(' ');

  return (
    <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="rounded border border-slate-300 bg-white p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="h-20 w-full touch-none select-none"
          onPointerUp={() => setActiveIndex(null)}
          onPointerCancel={() => setActiveIndex(null)}
        >
          <rect x={0} y={0} width={graph.width} height={graph.height} fill="transparent" />
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const x = graph.padding + (graph.width - graph.padding * 2) * tick;
            return (
              <line
                key={`x-${tick}`}
                x1={x}
                y1={graph.padding}
                x2={x}
                y2={graph.height - graph.padding}
                stroke="#e2e8f0"
              />
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = graph.padding + (graph.height - graph.padding * 2) * tick;
            return (
              <line
                key={`y-${tick}`}
                x1={graph.padding}
                y1={y}
                x2={graph.width - graph.padding}
                y2={y}
                stroke="#e2e8f0"
              />
            );
          })}
          {linePath && <path d={linePath} fill="none" stroke="#334155" strokeWidth={2} />}
          {keys.map((key, index) => {
            const point = toPoint(key.t, key.v);
            return (
              <circle
                key={`${key.t}-${key.v}-${index}`}
                cx={point.x}
                cy={point.y}
                r={4.5}
                fill="#1d4ed8"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setActiveIndex(index);
                }}
              />
            );
          })}
        </svg>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
          <span>t: 0</span>
          <span>t: 1</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="flex items-center justify-center gap-2 w-full rounded bg-slate-700 px-2 py-1 text-xs text-white cursor-pointer hover:bg-slate-800"
          type="button"
          onClick={() => {
            if (keys.length < 2) {
              updateKeys([...keys, { t: 0.5, v: 1 }]);
              return;
            }

            let bestGapIndex = 0;
            let bestGapSize = -1;
            for (let index = 0; index < keys.length - 1; index += 1) {
              const gap = keys[index + 1].t - keys[index].t;
              if (gap > bestGapSize) {
                bestGapSize = gap;
                bestGapIndex = index;
              }
            }

            const left = keys[bestGapIndex];
            const right = keys[bestGapIndex + 1];
            const nextKey = {
              t: (left.t + right.t) / 2,
              v: (left.v + right.v) / 2,
            };

            updateKeys([...keys, nextKey]);
          }}
        >
          <CirclePlus size={12} aria-hidden="true" />
          キー追加
        </button>
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-slate-700">詳細編集 (t / v)</summary>
        <div className="mt-2 space-y-2">
          {keys.map((key, index) => (
            <div
              key={`detail-${index}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2"
            >
              <span className="text-xs text-slate-700">t</span>
              <input
                className="min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                type="number"
                value={key.t}
                min={0}
                max={1}
                step={0.01}
                disabled={index === 0 || index === keys.length - 1}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) updateKeyAt(index, { t: nextValue });
                }}
              />
              <span className="text-xs text-slate-700">v</span>
              <input
                className="min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                type="number"
                value={key.v}
                min={0}
                max={1}
                step={0.01}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) updateKeyAt(index, { v: nextValue });
                }}
              />
              {index === 0 || index === keys.length - 1 ? (
                <div className="w-7 h-7"></div>
              ) : (
                <button
                  className="flex items-center justify-center w-7 h-7 rounded bg-red-700 text-xs text-white cursor-pointer hover:bg-red-800"
                  type="button"
                  onClick={() => {
                    updateKeys(keys.filter((_, itemIndex) => itemIndex !== index));
                  }}
                  aria-label="キーを削除"
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export function SelectField<T extends string>({
  className,
  label,
  value,
  options,
  onChange,
}: {
  className?: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className={cx('grid grid-cols-[minmax(0,1fr)_120px] items-center gap-2 text-sm', className)}>
      <span>{label}</span>
      <select
        className="rounded border border-slate-300 bg-white px-2 py-1"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeCurveKeys(keys: Curve['keys']) {
  return [...keys].sort((a, b) => a.t - b.t);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
