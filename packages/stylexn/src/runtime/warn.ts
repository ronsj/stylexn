const warned = new Set<string>();

/** Dev-time warning emitted once per key; the runtime never throws for style problems. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[stylexn] ${message}`);
}

/** Test hook. */
export function resetWarningsForTesting(): void {
  warned.clear();
}
