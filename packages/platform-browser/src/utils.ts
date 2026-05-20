import { Color, Font, MediaQuery, MediaSupportLevel } from '@rutan/midorable';

let mediaQueryCanvas: HTMLCanvasElement | null = null;

export function colorToCss(color: Color): string {
  const r = Math.min(255, Math.max(0, Math.round(color.r)));
  const g = Math.min(255, Math.max(0, Math.round(color.g)));
  const b = Math.min(255, Math.max(0, Math.round(color.b)));
  const a = Math.min(1, Math.max(0, color.a));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function fontToCss(font: Font): string {
  const style = font.style ?? 'normal';
  const weight = font.weight ?? 'normal';
  const family = Array.isArray(font.family) ? font.family : [font.family];
  return `${style} ${weight} ${font.size}px ${family.map(formatFontFamily).join(', ')}`;
}

export function mediaQuery({ type, mime }: MediaQuery): MediaSupportLevel {
  const lowerMime = mime.trim().toLowerCase();
  if (!lowerMime) {
    return 'unknown';
  }

  switch (type) {
    case 'audio':
      return resolveCanPlayTypeSupport('audio', lowerMime);
    case 'image':
      return resolveImageMimeSupport(lowerMime);
    default: {
      const _exhaustiveCheck: never = type;
      return 'unknown';
    }
  }
}

function resolveCanPlayTypeSupport(type: 'audio' | 'video', mime: string): MediaSupportLevel {
  if (typeof document === 'undefined') {
    return 'unknown';
  }
  const element = document.createElement(type);
  const support = element.canPlayType(mime);
  if (support === 'probably' || support === 'maybe') {
    return 'supported';
  }
  return 'unsupported';
}

function formatFontFamily(family: string): string {
  const trimmed = family.trim();
  if (/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(trimmed)) {
    return trimmed;
  }
  return JSON.stringify(trimmed);
}

function resolveImageMimeSupport(mime: string): MediaSupportLevel {
  if (typeof document === 'undefined') {
    return 'unknown';
  }
  if (!mediaQueryCanvas) {
    mediaQueryCanvas = document.createElement('canvas');
  }
  try {
    const encoded = mediaQueryCanvas.toDataURL(mime);
    return encoded.startsWith(`data:${mime}`) ? 'supported' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}
