export function lmBufferCommand(naturalId: string) {
  return `LM ${naturalId}`;
}

// 'loading' is the window before the FIO lookup answers; 'unavailable' means it
// answered with nothing (offline, non-200, unparseable, or field missing).
export type PlanetLocalMarket = boolean | 'loading' | 'unavailable';

export interface LmLinkTarget {
  inFlight: boolean;
  kind: 'planet' | 'station' | undefined;
  naturalId: string | undefined;
  planetLocalMarket: PlanetLocalMarket;
}

export function lmLinkNaturalId(target: LmLinkTarget) {
  if (target.inFlight || target.kind === undefined || target.naturalId === undefined) {
    return undefined;
  }
  // Stations always have a local market.
  if (target.kind === 'station') {
    return target.naturalId;
  }
  // A planet links when FIO says it has a market, and also when FIO could not be
  // reached, because LM reports "This planet has no local market." by itself.
  // Failing open costs a wasted click; failing closed hides a link that works.
  if (target.planetLocalMarket === false || target.planetLocalMarket === 'loading') {
    return undefined;
  }
  return target.naturalId;
}
