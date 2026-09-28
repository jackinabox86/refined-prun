// Per-planet "force CX buy" toggle set in GOVBURNACT, keyed by planet natural id.
// A planet with no stored entry keeps subtracting CX inventory, so turning the
// toggle on for one planet never changes what any other planet buys.

export function planetForceCXBuy(
  map: Record<string, boolean> | undefined,
  naturalId: string | undefined,
): boolean {
  if (naturalId === undefined || naturalId === '') {
    return false;
  }
  return map?.[naturalId] === true;
}

// Off is the absence of an entry, so the map never fills up with false values.
export function setPlanetForceCXBuy(
  map: Record<string, boolean>,
  naturalId: string,
  force: boolean,
): void {
  if (force) {
    map[naturalId] = true;
  } else {
    delete map[naturalId];
  }
}

// CX Buy subtracts warehouse stock unless this planet's force toggle is on.
export function govBurnUseCXInv(forceCXBuy: boolean | undefined) {
  return forceCXBuy !== true;
}
