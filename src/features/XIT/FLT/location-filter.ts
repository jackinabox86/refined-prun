import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';
import {
  getEntityNaturalIdFromAddress,
  getSystemLineFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { getStarNaturalId, getStarName, starsStore } from '@src/infrastructure/prun-api/data/stars';

export type FltLocationFilter =
  | { kind: 'planet'; naturalId: string }
  | { kind: 'system'; naturalId: string };

export interface FltLocationLookups {
  findPlanetNaturalId: (raw: string, parts: string[]) => string | undefined;
  findSystemNaturalId: (raw: string) => string | undefined;
  findExchangeSystemNaturalId: (raw: string) => string | undefined;
}

export const defaultFltLocationLookups: FltLocationLookups = {
  findPlanetNaturalId: (raw, parts) => {
    const fromCatalog = convertToPlanetNaturalId(raw, parts);
    if (fromCatalog !== undefined) {
      return fromCatalog;
    }
    // FIO planet rows can lag SYSTEM_STARS_DATA. A system id plus one letter
    // is still a planet natural id (`ZV-307a`), so accept it from stars.
    const star = starsStore.getByPlanetNaturalId(raw);
    if (star === undefined) {
      return undefined;
    }
    const systemId = getStarNaturalId(star);
    if (raw.length !== systemId.length + 1) {
      return undefined;
    }
    return raw;
  },
  findSystemNaturalId: raw => {
    const star = starsStore.find(raw);
    return star !== undefined ? getStarNaturalId(star) : undefined;
  },
  findExchangeSystemNaturalId: raw =>
    getSystemLineFromAddress(exchangesStore.getByNaturalId(raw)?.address)?.entity.naturalId,
};

export function resolveFltLocationFilter(
  parameters: string[],
  lookups: FltLocationLookups = defaultFltLocationLookups,
): FltLocationFilter | undefined {
  if (parameters.length === 0) {
    return undefined;
  }

  const raw = parameters.join(' ');
  const planetNaturalId = lookups.findPlanetNaturalId(raw, parameters);
  if (planetNaturalId !== undefined) {
    return { kind: 'planet', naturalId: planetNaturalId };
  }

  const systemNaturalId =
    lookups.findSystemNaturalId(raw) ?? lookups.findExchangeSystemNaturalId(raw);
  if (systemNaturalId !== undefined) {
    return { kind: 'system', naturalId: systemNaturalId };
  }

  return undefined;
}

export function formatFltLocationFilter(filter: FltLocationFilter): string {
  if (filter.kind === 'planet') {
    return planetsStore.getByNaturalId(filter.naturalId)?.name ?? filter.naturalId;
  }
  const star = starsStore.getByNaturalId(filter.naturalId);
  return star !== undefined ? getStarName(star) : filter.naturalId;
}

export function areFltLocationCatalogsReady() {
  return starsStore.all.value !== undefined && planetsStore.all.value !== undefined;
}

export function getShipLocationAddress(
  ship: PrunApi.Ship,
  flight?: PrunApi.Flight,
): PrunApi.Address | undefined {
  return flight?.destination ?? ship.address ?? undefined;
}

export function shipMatchesLocationFilter(
  address: PrunApi.Address | undefined,
  filter: FltLocationFilter,
): boolean {
  if (address === undefined) {
    return false;
  }
  if (filter.kind === 'planet') {
    return sameNaturalId(getEntityNaturalIdFromAddress(address), filter.naturalId);
  }
  return sameNaturalId(getSystemLineFromAddress(address)?.entity.naturalId, filter.naturalId);
}

function sameNaturalId(left?: string, right?: string) {
  return left !== undefined && right !== undefined && left.toUpperCase() === right.toUpperCase();
}
