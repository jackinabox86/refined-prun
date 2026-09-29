import { describe, expect, it } from 'vitest';
import {
  resolveRouteStop,
  type RouteStopLookups,
} from '@src/features/XIT/ROUTE/resolve-route-stop';

const lookups: RouteStopLookups = {
  findPlanet: raw =>
    raw.toLowerCase() === 'hortus a' ? { naturalId: 'VH-331a', label: 'Hortus a' } : undefined,
  findExchange: raw =>
    raw.toUpperCase() === 'ANT' ? { naturalId: 'ANT', label: 'Antares Station' } : undefined,
};

describe('resolveRouteStop', () => {
  it('resolves a planet name to that planet', () => {
    expect(resolveRouteStop('Hortus a', lookups)).toEqual({
      raw: 'Hortus a',
      label: 'Hortus a',
      query: 'VH-331a',
    });
  });

  it('resolves a CX ticker to the exchange station, not its system', () => {
    expect(resolveRouteStop('ANT', lookups)).toEqual({
      raw: 'ANT',
      label: 'Antares Station',
      query: 'ANT',
    });
  });

  it('prefers a planet when the same text could be read as something else', () => {
    const planetFirst: RouteStopLookups = {
      findPlanet: () => ({ naturalId: 'VH-331a', label: 'Hortus a' }),
      findExchange: () => ({ naturalId: 'ANT', label: 'Antares Station' }),
    };
    expect(resolveRouteStop('Hortus a', planetFirst).query).toBe('VH-331a');
  });

  it('reports a stop that is neither a planet nor an exchange', () => {
    expect(resolveRouteStop('NOPE', lookups).error).toBe('unknown stop "NOPE"');
  });
});
