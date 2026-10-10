export function resolveDispatchAutoSize(
  userRule: readonly [number, number] | undefined,
  contentWidth: number,
  parsedHeight: number,
): [number, number] {
  if (userRule !== undefined) {
    return [userRule[0], userRule[1]];
  }
  return [contentWidth, Number.isNaN(parsedHeight) ? 500 : parsedHeight];
}
