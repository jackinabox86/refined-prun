const narrowed = new Set(['SHP', 'SHPF', 'SFC']);

export function shouldNarrowShipContextCommand(command: string | null | undefined) {
  if (command === null || command === undefined) {
    return false;
  }
  return narrowed.has(command);
}
