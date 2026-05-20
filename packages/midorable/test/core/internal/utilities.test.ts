import { describe, expect, it } from 'vitest';
import { clamp } from '../../../src/core/internal/utilities';

describe('clamp', () => {
  it('returns the value if it is within the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });
});
