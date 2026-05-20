import { Color, ParticleEmitterConfig, ParticleForce, ParticleSpawnConfig } from '@rutan/midorable';
import { CirclePlus, Trash } from 'lucide-react';
import { CurveField, NumberField, OptionalScalarField, ScalarField, Section, SelectField } from './EditorFields';

export function SettingsTab({
  config,
  updateConfig,
  updateSpawn,
  updateForces,
}: {
  config: ParticleEmitterConfig;
  updateConfig: (update: (previous: ParticleEmitterConfig) => ParticleEmitterConfig) => void;
  updateSpawn: (update: (previous: ParticleSpawnConfig) => ParticleSpawnConfig) => void;
  updateForces: (update: (previous: ParticleForce[]) => ParticleForce[]) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="エミッター">
        <div className="grid grid-cols-1 gap-2">
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">時間</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.duration < 0}
                  onChange={(event) => {
                    updateConfig((previous) => ({
                      ...previous,
                      duration: event.target.checked ? -1 : 1,
                    }));
                  }}
                />
                無限再生
              </label>
            </div>
            {config.duration >= 0 && (
              <NumberField
                label="射出時間(秒)"
                value={config.duration}
                min={0}
                step={0.1}
                onChange={(nextValue) => updateConfig((previous) => ({ ...previous, duration: nextValue }))}
              />
            )}
          </div>
          <ScalarField
            label="1秒間の射出数"
            value={config.emissionRate}
            min={0}
            step={1}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, emissionRate: nextValue }))}
          />
          <OptionalScalarField
            label="一度に射出する数"
            enabled={typeof config.burstCount !== 'undefined'}
            value={config.burstCount ?? 1}
            min={1}
            step={1}
            onEnabledChange={(enabled) => {
              updateConfig((previous) => ({
                ...previous,
                burstCount: enabled ? 1 : undefined,
              }));
            }}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, burstCount: nextValue }))}
          />
        </div>
      </Section>

      <Section title="発生位置">
        <div className="grid grid-cols-1 gap-2">
          <SelectField
            label="Type"
            value={config.spawn.type}
            options={[
              { value: 'point', label: 'point' },
              { value: 'circle', label: 'circle' },
              { value: 'rectangle', label: 'rectangle' },
            ]}
            onChange={(nextType) => {
              updateSpawn((previous) => {
                if (previous.type === nextType) return previous;
                if (nextType === 'point') return { type: 'point', x: previous.x, y: previous.y };
                if (nextType === 'circle') {
                  return { type: 'circle', x: previous.x, y: previous.y, radius: 48, edgeOnly: false };
                }
                return { type: 'rectangle', x: previous.x, y: previous.y, width: 96, height: 96 };
              });
            }}
          />
          <NumberField
            label="X"
            value={config.spawn.x}
            step={1}
            onChange={(nextValue) => updateSpawn((previous) => ({ ...previous, x: nextValue }))}
          />
          <NumberField
            label="Y"
            value={config.spawn.y}
            step={1}
            onChange={(nextValue) => updateSpawn((previous) => ({ ...previous, y: nextValue }))}
          />
          {config.spawn.type === 'circle' && (
            <>
              <NumberField
                label="Radius"
                value={config.spawn.radius}
                min={0}
                step={1}
                onChange={(nextValue) => updateSpawn((previous) => ({ ...previous, radius: nextValue }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.spawn.edgeOnly ?? false}
                  onChange={(event) =>
                    updateSpawn((previous) => ({
                      ...previous,
                      edgeOnly: event.target.checked,
                    }))
                  }
                />
                円周上のみ生成
              </label>
            </>
          )}
          {config.spawn.type === 'rectangle' && (
            <>
              <NumberField
                label="Width"
                value={config.spawn.width}
                min={0}
                step={1}
                onChange={(nextValue) => updateSpawn((previous) => ({ ...previous, width: nextValue }))}
              />
              <NumberField
                label="Height"
                value={config.spawn.height}
                min={0}
                step={1}
                onChange={(nextValue) => updateSpawn((previous) => ({ ...previous, height: nextValue }))}
              />
            </>
          )}
        </div>
      </Section>

      <Section title="粒子モーション">
        <div className="grid grid-cols-1 gap-2">
          <ScalarField
            label="生存時間(秒)"
            value={config.lifetime}
            min={0.01}
            step={0.01}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, lifetime: nextValue }))}
          />
          <ScalarField
            label="移動速度"
            value={config.speed}
            min={0}
            step={1}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, speed: nextValue }))}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeof config.speedOverLife !== 'undefined'}
                onChange={(event) => {
                  updateConfig((previous) => ({
                    ...previous,
                    speedOverLife: event.target.checked
                      ? {
                          keys: [
                            { t: 0, v: 1 },
                            { t: 1, v: 1 },
                          ],
                        }
                      : undefined,
                  }));
                }}
              />
              時間で変化させる
            </label>
            {config.speedOverLife && (
              <CurveField
                value={config.speedOverLife}
                onChange={(nextValue) => updateConfig((previous) => ({ ...previous, speedOverLife: nextValue }))}
              />
            )}
          </ScalarField>
          <ScalarField
            label="移動方向(度)"
            value={config.direction}
            step={1}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, direction: nextValue }))}
          />
          <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={config.alignToDirection ?? false}
              onChange={(event) => {
                updateConfig((previous) => ({
                  ...previous,
                  alignToDirection: event.target.checked,
                }));
              }}
            />
            向きを移動方向に合わせる
          </label>
          <OptionalScalarField
            label="角速度"
            enabled={typeof config.angularVelocity !== 'undefined'}
            value={config.angularVelocity ?? 0}
            step={1}
            onEnabledChange={(enabled) => {
              updateConfig((previous) => ({
                ...previous,
                angularVelocity: enabled ? 0 : undefined,
                angularVelocityOverLife: enabled ? previous.angularVelocityOverLife : undefined,
              }));
            }}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, angularVelocity: nextValue }))}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeof config.angularVelocityOverLife !== 'undefined'}
                onChange={(event) => {
                  updateConfig((previous) => ({
                    ...previous,
                    angularVelocityOverLife: event.target.checked
                      ? {
                          keys: [
                            { t: 0, v: 1 },
                            { t: 1, v: 1 },
                          ],
                        }
                      : undefined,
                  }));
                }}
              />
              角速度を時間で変化させる
            </label>
            {config.angularVelocityOverLife && (
              <CurveField
                value={config.angularVelocityOverLife}
                onChange={(nextValue) =>
                  updateConfig((previous) => ({ ...previous, angularVelocityOverLife: nextValue }))
                }
              />
            )}
          </OptionalScalarField>
          <ScalarField
            label="拡大率"
            value={config.scale}
            min={0}
            step={0.01}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, scale: nextValue }))}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeof config.scaleOverLife !== 'undefined'}
                onChange={(event) => {
                  updateConfig((previous) => ({
                    ...previous,
                    scaleOverLife: event.target.checked
                      ? {
                          keys: [
                            { t: 0, v: 1 },
                            { t: 1, v: 1 },
                          ],
                        }
                      : undefined,
                  }));
                }}
              />
              時間で変化させる
            </label>
            {config.scaleOverLife && (
              <CurveField
                value={config.scaleOverLife}
                onChange={(nextValue) => updateConfig((previous) => ({ ...previous, scaleOverLife: nextValue }))}
              />
            )}
          </ScalarField>
        </div>
      </Section>

      <Section title="描画">
        <div className="grid grid-cols-1 gap-2">
          <SelectField
            label="Blend Mode"
            value={config.blendMode ?? 'normal'}
            options={[
              { value: 'normal', label: 'normal' },
              { value: 'add', label: 'add' },
              { value: 'subtract', label: 'subtract' },
            ]}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, blendMode: nextValue }))}
          />
          <ScalarField
            label="透明度"
            value={config.alpha}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) => updateConfig((previous) => ({ ...previous, alpha: nextValue }))}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={typeof config.alphaOverLife !== 'undefined'}
                onChange={(event) => {
                  updateConfig((previous) => ({
                    ...previous,
                    alphaOverLife: event.target.checked
                      ? {
                          keys: [
                            { t: 0, v: 1 },
                            { t: 1, v: 0 },
                          ],
                        }
                      : undefined,
                  }));
                }}
              />
              時間で変化させる
            </label>
            {config.alphaOverLife && (
              <CurveField
                value={config.alphaOverLife}
                onChange={(nextValue) => updateConfig((previous) => ({ ...previous, alphaOverLife: nextValue }))}
              />
            )}
          </ScalarField>
          <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={typeof config.color !== 'undefined'}
                onChange={(event) => {
                  updateConfig((previous) => ({
                    ...previous,
                    color: event.target.checked
                      ? {
                          start: { r: 255, g: 0, b: 0, a: 0.5 },
                          end: { r: 255, g: 255, b: 0, a: 0.5 },
                        }
                      : undefined,
                  }));
                }}
              />
              カラートーン
            </label>
            {config.color && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <ColorStopEditor
                  label="Start"
                  value={config.color.start}
                  onChange={(nextValue) =>
                    updateConfig((previous) => ({
                      ...previous,
                      color: previous.color ? { ...previous.color, start: nextValue } : previous.color,
                    }))
                  }
                />
                <ColorStopEditor
                  label="End"
                  value={config.color.end}
                  onChange={(nextValue) =>
                    updateConfig((previous) => ({
                      ...previous,
                      color: previous.color ? { ...previous.color, end: nextValue } : previous.color,
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="外部からの力">
        <div className="space-y-3">
          {config.forces.map((force, index) => (
            <div key={index} className="rounded border border-slate-300 bg-white p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SelectField
                  className="flex-1"
                  label={`Force ${index + 1}`}
                  value={force.type}
                  options={[
                    { value: 'gravity', label: 'gravity' },
                    { value: 'attractor', label: 'attractor' },
                  ]}
                  onChange={(nextType) => {
                    updateForces((previous) =>
                      previous.map((item, itemIndex) => {
                        if (itemIndex !== index) return item;
                        if (item.type === nextType) return item;
                        if (nextType === 'gravity') return { type: 'gravity', x: item.x, y: item.y };
                        return {
                          type: 'attractor',
                          x: item.x,
                          y: item.y,
                          strength: 140,
                        };
                      }),
                    );
                  }}
                />
                <button
                  className="flex items-center justify-center w-7 h-7 rounded bg-red-700 px-2 py-1 text-xs text-white cursor-pointer hover:bg-red-800"
                  type="button"
                  onClick={() => {
                    updateForces((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
                  }}
                  aria-label="削除"
                >
                  <Trash size={12} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <NumberField
                  label="X"
                  value={force.x}
                  step={1}
                  onChange={(nextValue) =>
                    updateForces((previous) =>
                      previous.map((item, itemIndex) => (itemIndex === index ? { ...item, x: nextValue } : item)),
                    )
                  }
                />
                <NumberField
                  label="Y"
                  value={force.y}
                  step={1}
                  onChange={(nextValue) =>
                    updateForces((previous) =>
                      previous.map((item, itemIndex) => (itemIndex === index ? { ...item, y: nextValue } : item)),
                    )
                  }
                />
                {force.type === 'attractor' && (
                  <>
                    <NumberField
                      label="Strength"
                      value={force.strength}
                      step={1}
                      onChange={(nextValue) =>
                        updateForces((previous) =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index && item.type === 'attractor' ? { ...item, strength: nextValue } : item,
                          ),
                        )
                      }
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={typeof force.killDistance !== 'undefined'}
                        onChange={(event) =>
                          updateForces((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index && item.type === 'attractor'
                                ? {
                                    ...item,
                                    killDistance: event.target.checked ? 12 : undefined,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      Kill Distance を有効化
                    </label>
                    {typeof force.killDistance !== 'undefined' && (
                      <NumberField
                        label="Kill Distance"
                        value={force.killDistance}
                        min={0}
                        step={1}
                        onChange={(nextValue) =>
                          updateForces((previous) =>
                            previous.map((item, itemIndex) =>
                              itemIndex === index && item.type === 'attractor'
                                ? { ...item, killDistance: nextValue }
                                : item,
                            ),
                          )
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <button
            className="flex w-full items-center justify-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-white cursor-pointer hover:bg-slate-800"
            onClick={() => {
              updateForces((previous) => [...previous, { type: 'gravity', x: 0, y: 120 }]);
            }}
            type="button"
          >
            <CirclePlus size={12} aria-hidden="true" />
            追加
          </button>
        </div>
      </Section>
    </div>
  );
}

function ColorStopEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Color;
  onChange: (nextValue: Color) => void;
}) {
  return (
    <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <input
          className="h-9 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
          type="color"
          value={rgbToHex(value)}
          onChange={(event) => {
            const rgb = hexToRgb(event.target.value);
            onChange({ ...value, ...rgb });
          }}
          aria-label={`${label} color`}
        />
      </div>
      <label className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2 text-sm">
        <span>Alpha</span>
        <span className="text-right font-mono text-xs text-slate-700">{value.a.toFixed(2)}</span>
      </label>
      <input
        className="w-full"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value.a}
        onChange={(event) => onChange({ ...value, a: clamp01(Number(event.target.value)) })}
      />
    </div>
  );
}

function rgbToHex(color: Color): string {
  const r = Math.round(clamp255(color.r)).toString(16).padStart(2, '0');
  const g = Math.round(clamp255(color.g)).toString(16).padStart(2, '0');
  const b = Math.round(clamp255(color.b)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): Pick<Color, 'r' | 'g' | 'b'> {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : raw;
  const safe = normalized.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value));
}
