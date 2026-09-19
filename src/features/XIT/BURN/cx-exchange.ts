// Per-base CX buy exchange remembered by BURNACT.
// Only a value the player actually chose is stored — opening a base never
// invents AI1 (or any other exchange) for one that has no selection yet.

export function savedPlanetCxExchange(
  map: Record<string, string> | undefined,
  planetId: string | undefined,
): string | undefined {
  if (planetId === undefined) {
    return undefined;
  }
  return map?.[planetId];
}

export function rememberPlanetCxExchange(
  map: Record<string, string>,
  planetId: string,
  exchange: string | undefined,
): void {
  if (exchange === undefined || exchange === '') {
    return;
  }
  map[planetId] = exchange;
}
