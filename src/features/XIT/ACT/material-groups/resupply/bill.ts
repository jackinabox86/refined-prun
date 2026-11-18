import { calculatePlanetBurn } from '@src/core/burn';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { workforcesStore } from '@src/infrastructure/prun-api/data/workforces';
import { productionStore } from '@src/infrastructure/prun-api/data/production';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import type { MaterialFilter } from './config';

// What a material uses over `days`. Workforce eats a whole day's need at once, so
// with `minWorkforceDays` the workforce share never covers fewer days than that.
export function consumedOver(
  days: number,
  dailyUse: number,
  workforce: number,
  minWorkforceDays = 0,
) {
  return days * dailyUse + Math.max(0, minWorkforceDays - days) * workforce;
}

// Computes the resupply material bill for a given planet and day count.
// Returns undefined when inputs are missing or when the site's burn data is
// not yet loaded. Kept synchronous so it can be driven reactively from the
// Configure window.
export function computeResupplyBill(
  data: UserData.MaterialGroupData,
  planet: string | undefined,
  days: number | undefined,
  materialFilter?: MaterialFilter,
  minWorkforceDays?: number,
): Record<string, number> | undefined {
  if (!planet || days === undefined || isNaN(days)) {
    return undefined;
  }
  const site = sitesStore.getByPlanetNaturalIdOrName(planet);
  if (!site) {
    return undefined;
  }
  const workforce = workforcesStore.getById(site.siteId)?.workforces;
  const production = productionStore.getBySiteId(site.siteId);
  if (workforce === undefined || production === undefined) {
    return undefined;
  }
  const stores = storagesStore.getByAddressableId(site.siteId);

  const filter =
    materialFilter ?? data.materialFilter ?? (data.consumablesOnly ? 'Workforce' : 'All');
  const planetBurn = calculatePlanetBurn(
    production,
    workforce,
    (data.useBaseInv ?? true) ? stores : undefined,
  );

  const exclusions = data.exclusions ?? [];
  const bill: Record<string, number> = {};
  for (const ticker of Object.keys(planetBurn)) {
    if (exclusions.includes(ticker)) {
      continue;
    }
    const matBurn = planetBurn[ticker];
    // For filtered modes, only include materials with primary demand type.
    // Still use full dailyAmount so cross-demand (e.g. a workforce consumable
    // that is also a production input) is fully accounted for.
    if (filter === 'Workforce' && matBurn.workforce === 0) {
      continue;
    }
    if (filter === 'Production' && matBurn.input === 0) {
      continue;
    }
    if (matBurn.dailyAmount >= 0) {
      continue;
    }
    const consumed = consumedOver(days, -matBurn.dailyAmount, matBurn.workforce, minWorkforceDays);
    const need = Math.max(0, Math.ceil(consumed - matBurn.inventory + 1));
    if (need > 0) {
      bill[ticker] = need;
    }
  }
  return bill;
}
