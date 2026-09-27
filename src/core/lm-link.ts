export function lmBufferCommand(naturalId: string) {
  return `LM ${naturalId}`;
}

export interface LmLinkTarget {
  inFlight: boolean;
  kind: 'planet' | 'station' | undefined;
  naturalId: string | undefined;
  planetHasLocalMarket: boolean | undefined;
}

// Stations always have a local market. A planet link waits until FIO says
// HasLocalMarket is true — unknown and false both stay hidden.
export function lmLinkNaturalId(target: LmLinkTarget) {
  if (target.inFlight || target.kind === undefined || target.naturalId === undefined) {
    return undefined;
  }
  if (target.kind === 'station') {
    return target.naturalId;
  }
  if (target.planetHasLocalMarket !== true) {
    return undefined;
  }
  return target.naturalId;
}
