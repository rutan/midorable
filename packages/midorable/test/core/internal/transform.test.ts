import { describe, expect, it } from 'vitest';
import { applyTransform, invertTransform, multiplyTransform } from '../../../src/core/internal/transform';

describe('transform utils', () => {
  it('applyTransform applies matrix and translation', () => {
    const transform = {
      a: 2,
      b: 3,
      c: 4,
      d: 5,
      tx: 6,
      ty: 7,
    };

    const result = applyTransform(transform, 10, 20);

    expect(result).toEqual({
      x: 106,
      y: 137,
    });
  });

  it('multiplyTransform composes parent and local transforms', () => {
    const parent = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      tx: 5,
      ty: 6,
    };
    const local = {
      a: 7,
      b: 8,
      c: 9,
      d: 10,
      tx: 11,
      ty: 12,
    };

    const result = multiplyTransform(parent, local);

    expect(result).toEqual({
      a: 31,
      b: 46,
      c: 39,
      d: 58,
      tx: 52,
      ty: 76,
    });
  });

  it('invertTransform returns null for non-invertible transform', () => {
    const singular = {
      a: 1,
      b: 2,
      c: 2,
      d: 4,
      tx: 10,
      ty: 20,
    };

    expect(invertTransform(singular)).toBeNull();
  });

  it('invertTransform creates inverse that restores original point', () => {
    const transform = {
      a: 2,
      b: 1,
      c: 3,
      d: 4,
      tx: 5,
      ty: 6,
    };
    const point = { x: 7, y: 11 };

    const inverse = invertTransform(transform);
    expect(inverse).not.toBeNull();
    if (!inverse) {
      return;
    }

    const world = applyTransform(transform, point.x, point.y);
    const restored = applyTransform(inverse, world.x, world.y);

    expect(restored.x).toBeCloseTo(point.x, 10);
    expect(restored.y).toBeCloseTo(point.y, 10);
  });
});
