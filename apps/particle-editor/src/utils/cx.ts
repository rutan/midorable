export function cx(...classNames: (string | boolean | undefined | null)[]) {
  return classNames.filter(Boolean).join(' ');
}
