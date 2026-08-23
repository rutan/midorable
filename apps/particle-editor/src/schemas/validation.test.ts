import { describe, expect, it } from 'vitest';
import { generateValidationErrorMessage, parseTexturePackFrames } from '../utils';
import { particleEmitterConfigSchema } from './particleEmitterConfig';

describe('particleEmitterConfigSchema', () => {
  it('複合的な設定を検証し、エディタが知らない拡張プロパティを保持する', () => {
    const input = {
      duration: -1,
      spawn: { type: 'rectangle', x: -10, y: -20, width: 20, height: 40, extension: 'spawn' },
      emissionRate: { min: 30, max: 60 },
      burstCount: 2,
      lifetime: { min: 0.2, max: 0.8 },
      speed: 100,
      speedOverLife: { keys: [{ t: 0, v: 1 }], extension: 'curve' },
      direction: { min: 0, max: 360 },
      alignToDirection: true,
      angularVelocity: { min: -10, max: 10 },
      angularVelocityOverLife: { keys: [{ t: 1, v: 0 }] },
      scale: 1,
      scaleOverLife: { keys: [{ t: 0.5, v: 2 }] },
      alpha: { min: 0.5, max: 1 },
      alphaOverLife: { keys: [{ t: 1, v: 0 }] },
      color: {
        start: { r: 255, g: 128, b: 0, a: 1 },
        end: { r: 0, g: 0, b: 0, a: 0 },
      },
      blendMode: 'add',
      forces: [
        { type: 'gravity', x: 0, y: 9.8 },
        { type: 'attractor', x: 10, y: 20, strength: -100, killDistance: 2 },
      ],
      extension: { author: 'editor-plugin' },
    };

    const result = particleEmitterConfigSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.extension).toEqual({ author: 'editor-plugin' });
    expect(result.data.spawn.extension).toBe('spawn');
    expect(result.data.speedOverLife?.extension).toBe('curve');
  });

  it('ネストした値と判別可能なunionの不正を報告する', () => {
    const result = particleEmitterConfigSchema.safeParse({
      ...createMinimumConfig(),
      spawn: { type: 'line', x: 0, y: 0 },
      alpha: { min: 0, max: 'opaque' },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['spawn', 'type'] }),
        expect.objectContaining({ path: ['alpha'] }),
      ]),
    );
    expect(generateValidationErrorMessage(result.error.issues)).toContain('$["alpha"]["max"]');
  });
});

describe('parseTexturePackFrames', () => {
  it('フレーム名のrecordをエディタ向けの配列へ変換する', () => {
    const result = parseTexturePackFrames({
      image: 'particles.png',
      frames: {
        smoke: { x: 0, y: 0, width: 32, height: 32 },
        spark: { x: 32, y: 0, width: 16, height: 16 },
      },
    });

    expect(result).toEqual({
      success: true,
      data: {
        image: 'particles.png',
        frames: [
          { name: 'smoke', frame: { x: 0, y: 0, width: 32, height: 32 } },
          { name: 'spark', frame: { x: 32, y: 0, width: 16, height: 16 } },
        ],
      },
    });
  });

  it('不正なフレームの位置を利用者向けエラーに含める', () => {
    const result = parseTexturePackFrames({
      image: 'particles.png',
      frames: {
        smoke: { x: 0, y: 0, width: 'wide', height: 32 },
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(generateValidationErrorMessage(result.error.issues)).toContain('$["frames"]["smoke"]["width"]');
  });
});

function createMinimumConfig() {
  return {
    duration: -1,
    spawn: { type: 'point', x: 0, y: 0 },
    emissionRate: 1,
    lifetime: 1,
    speed: 1,
    direction: 0,
    scale: 1,
    alpha: 1,
    blendMode: 'normal',
    forces: [],
  };
}
