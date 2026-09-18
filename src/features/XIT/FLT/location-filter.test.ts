import { describe, expect, it } from 'vitest';
import {
  getShipLocationAddress,
  resolveFltLocationFilter,
  shipMatchesLocationFilter,
  type FltLocationLookups,
} from './location-filter';

const lookups: FltLocationLookups = {
  findPlanetNaturalId: (raw, parts) => {
    const joined = parts.join(' ');
    const planets: Record<string, string> = {
      'ZV-307a': 'ZV-307a',
      'zv-307a': 'ZV-307a',
      montem: 'OT-580b',
      'hortus a': 'VH-331a',
      'lom palanka': 'CH-771c',
    };
    return planets[raw] ?? planets[joined.toLowerCase()];
  },
  findSystemNaturalId: raw => {
    const systems: Record<string, string> = {
      'ZV-307': 'ZV-307',
      'zv-307': 'ZV-307',
      'antares i': 'ZV-307',
      'VH-331': 'VH-331',
      hortus: 'VH-331',
    };
    return systems[raw] ?? systems[raw.toLowerCase()];
  },
  findExchangeSystemNaturalId: raw => {
    const exchanges: Record<string, string> = {
      ANT: 'ZV-307',
      ant: 'ZV-307',
      HRT: 'VH-331',
    };
    return exchanges[raw] ?? exchanges[raw.toUpperCase()];
  },
};

function address(
  systemId: string,
  locationId: string,
  type: 'PLANET' | 'STATION',
): PrunApi.Address {
  return {
    lines: [
      {
        type: 'SYSTEM',
        entity: { id: `sys-${systemId}`, naturalId: systemId, name: systemId },
      },
      {
        type,
        entity: { id: `loc-${locationId}`, naturalId: locationId, name: locationId },
      },
    ],
  };
}

function shipAt(location: PrunApi.Address | null): PrunApi.Ship {
  return { address: location } as PrunApi.Ship;
}

function flightTo(destination: PrunApi.Address): PrunApi.Flight {
  return { destination } as PrunApi.Flight;
}

describe('resolveFltLocationFilter', () => {
  it('returns undefined when XIT FLT has no modifier', () => {
    expect(resolveFltLocationFilter([], lookups)).toBeUndefined();
  });

  it('joins spaced parameters so Hortus a and Lom Palanka resolve as planets', () => {
    expect(resolveFltLocationFilter(['Hortus', 'a'], lookups)).toEqual({
      kind: 'planet',
      naturalId: 'VH-331a',
    });
    expect(resolveFltLocationFilter(['Lom', 'Palanka'], lookups)).toEqual({
      kind: 'planet',
      naturalId: 'CH-771c',
    });
  });

  it('resolves a planet natural id before a system or CX ticker', () => {
    expect(resolveFltLocationFilter(['ZV-307a'], lookups)).toEqual({
      kind: 'planet',
      naturalId: 'ZV-307a',
    });
  });

  it('resolves a system natural id or name when it is not a planet', () => {
    expect(resolveFltLocationFilter(['ZV-307'], lookups)).toEqual({
      kind: 'system',
      naturalId: 'ZV-307',
    });
    expect(resolveFltLocationFilter(['Hortus'], lookups)).toEqual({
      kind: 'system',
      naturalId: 'VH-331',
    });
  });

  it('resolves a CX ticker to that station system, matching FLTS correction', () => {
    expect(resolveFltLocationFilter(['ANT'], lookups)).toEqual({
      kind: 'system',
      naturalId: 'ZV-307',
    });
    expect(resolveFltLocationFilter(['HRT'], lookups)).toEqual({
      kind: 'system',
      naturalId: 'VH-331',
    });
  });

  it('returns undefined for a modifier that matches nothing', () => {
    expect(resolveFltLocationFilter(['NOPE'], lookups)).toBeUndefined();
  });
});

describe('shipMatchesLocationFilter', () => {
  const antaresPlanet = address('ZV-307', 'ZV-307a', 'PLANET');
  const antaresMoon = address('ZV-307', 'ZV-307b', 'PLANET');
  const antaresStation = address('ZV-307', 'ANT', 'STATION');
  const hortusPlanet = address('VH-331', 'VH-331a', 'PLANET');

  it('matches a planet filter only at that planet, case-insensitively', () => {
    const filter = { kind: 'planet' as const, naturalId: 'zv-307a' };
    expect(shipMatchesLocationFilter(antaresPlanet, filter)).toBe(true);
    expect(shipMatchesLocationFilter(antaresMoon, filter)).toBe(false);
    expect(shipMatchesLocationFilter(antaresStation, filter)).toBe(false);
    expect(shipMatchesLocationFilter(hortusPlanet, filter)).toBe(false);
  });

  it('matches a system filter for planets and stations in that system only', () => {
    const filter = { kind: 'system' as const, naturalId: 'zv-307' };
    expect(shipMatchesLocationFilter(antaresPlanet, filter)).toBe(true);
    expect(shipMatchesLocationFilter(antaresMoon, filter)).toBe(true);
    expect(shipMatchesLocationFilter(antaresStation, filter)).toBe(true);
    expect(shipMatchesLocationFilter(hortusPlanet, filter)).toBe(false);
  });

  it('does not match a missing address', () => {
    expect(shipMatchesLocationFilter(undefined, { kind: 'system', naturalId: 'ZV-307' })).toBe(
      false,
    );
  });
});

describe('getShipLocationAddress', () => {
  const docked = address('ZV-307', 'ANT', 'STATION');
  const destination = address('VH-331', 'VH-331a', 'PLANET');

  it('uses destination while a ship is in flight, otherwise the docked address', () => {
    expect(getShipLocationAddress(shipAt(docked), flightTo(destination))).toBe(destination);
    expect(getShipLocationAddress(shipAt(docked))).toBe(docked);
    expect(getShipLocationAddress(shipAt(null))).toBeUndefined();
  });
});
