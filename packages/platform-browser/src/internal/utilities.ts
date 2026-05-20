export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clamp255(value: number): number {
  return Math.min(255, Math.max(0, value));
}
