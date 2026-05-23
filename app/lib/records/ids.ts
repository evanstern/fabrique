export function nextSequentialId(prefix: string, existing: number): string {
  const n = existing + 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
