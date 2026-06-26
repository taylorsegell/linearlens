export function scopesKey(scopes: readonly string[]): string {
  return [...scopes].sort().join(",");
}

export function scopesMatch(
  stored: readonly string[],
  requested: readonly string[]
): boolean {
  const storedSet = new Set(stored);
  return requested.every((scope) => storedSet.has(scope));
}
