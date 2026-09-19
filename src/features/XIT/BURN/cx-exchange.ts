// Per-base CX buy exchange remembered by BURNACT.
// A base with no stored selection starts on DEFAULT_CX_EXCHANGE; the stored map
// only ever holds a value that was actually in the package config.

export const DEFAULT_CX_EXCHANGE = 'AI1';

export function savedPlanetCxExchange(
  map: Record<string, string> | undefined,
  planetId: string | undefined,
): string | undefined {
  if (planetId === undefined) {
    return undefined;
  }
  return map?.[planetId];
}

// What BURNACT opens with: the remembered exchange, or the default until the
// player picks something else.
export function initialPlanetCxExchange(
  map: Record<string, string> | undefined,
  planetId: string | undefined,
): string {
  return savedPlanetCxExchange(map, planetId) ?? DEFAULT_CX_EXCHANGE;
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
