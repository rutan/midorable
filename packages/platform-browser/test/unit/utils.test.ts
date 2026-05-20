import { describe, expect, it } from 'vitest';
import { fontToCss } from '../../src/utils';

describe('browser utils', () => {
  it('formats font family arrays as a CSS fallback list', () => {
    expect(
      fontToCss({
        family: ['Noto Sans JP', 'system-ui', 'sans-serif'],
        size: 16,
      }),
    ).toBe('normal normal 16px "Noto Sans JP", system-ui, sans-serif');
  });

  it('quotes single font family names that contain spaces', () => {
    expect(
      fontToCss({
        family: 'M PLUS 1p',
        size: 24,
        style: 'italic',
        weight: 'bold',
      }),
    ).toBe('italic bold 24px "M PLUS 1p"');
  });
});
