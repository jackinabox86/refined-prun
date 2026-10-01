import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';
import { getPlanetName } from '@src/core/planet-name';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { getStarNaturalId, starsStore } from '@src/infrastructure/prun-api/data/stars';

export interface ResolvedPlace {
  naturalId: string;
  label: string;
}

export interface RouteStopLookups {
  findPlanet: (raw: string) => ResolvedPlace | undefined;
  findExchange: (raw: string) => ResolvedPlace | undefined;
}

export interface RouteStop {
  raw: string;
  label: string;
  query?: string;
  error?: string;
}

// Planet first, then a commodity exchange, matching XIT FLT's lookup order.
// A CX ticker stays the exchange station. FLT collapses that ticker to the
// station's system because it filters ships; a test flight has to land on the
// station itself.
export function resolveRouteStop(
  raw: string,
  lookups: RouteStopLookups = defaultRouteStopLookups,
): RouteStop {
  const planet = lookups.findPlanet(raw);
  if (planet !== undefined) {
    return { raw, label: planet.label, query: planet.naturalId };
  }
  const exchange = lookups.findExchange(raw);
  if (exchange !== undefined) {
    return { raw, label: exchange.label, query: exchange.naturalId };
  }
  return { raw, label: raw, error: `unknown stop "${raw}"` };
}

export const defaultRouteStopLookups: RouteStopLookups = {
  findPlanet(raw) {
    const naturalId = findPlanetNaturalId(raw);
    if (naturalId === undefined) {
      return undefined;
    }
    return { naturalId, label: getPlanetName(naturalId) };
  },
  findExchange(raw) {
    const exchange =
      exchangesStore.getByCode(raw) ??
      exchangesStore.getByNaturalId(raw) ??
      exchangesStore.getByName(raw);
    if (exchange === undefined) {
      return undefined;
    }
    const naturalId = getEntityNaturalIdFromAddress(exchange.address);
    if (naturalId === undefined) {
      return undefined;
    }
    return { naturalId, label: exchange.name };
  },
};

function findPlanetNaturalId(raw: string) {
  const fromCatalog = convertToPlanetNaturalId(raw);
  if (fromCatalog !== undefined) {
    return fromCatalog;
  }
  const star = starsStore.getByPlanetNaturalId(raw);
  if (star === undefined) {
    return undefined;
  }
  const systemId = getStarNaturalId(star);
  if (raw.length !== systemId.length + 1) {
    return undefined;
  }
  return raw;
}
