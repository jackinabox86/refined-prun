export function burnCellBufferCommand(
  event: { shiftKey: boolean },
  naturalId: string,
): string | undefined {
  if (!event.shiftKey) {
    return undefined;
  }
  return `XIT BURN ${naturalId}`;
}

export function toggleExpandedBurn(expanded: readonly string[], naturalId: string): string[] {
  if (expanded.includes(naturalId)) {
    return expanded.filter(x => x !== naturalId);
  }
  return [...expanded, naturalId];
}
