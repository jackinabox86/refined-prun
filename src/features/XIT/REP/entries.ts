import { isRepairableBuilding } from '@src/core/buildings';
import { getBuildingLastRepair, sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { diffDays } from '@src/utils/time-diff';
import { isEmpty } from 'ts-extras';

export { calculateBuildingEntries, calculateShipEntries } from '@src/core/repair';
export type { RepairEntry } from '@src/core/repair';

export function getParameterSites(parameters: string[]) {
  let sites: PrunApi.Site[] = [];
  if (isEmpty(parameters)) {
    if (sitesStore.all.value === undefined) {
      return undefined;
    }
    sites = sitesStore.all.value;
  }
  for (let i = 0; i < parameters.length; i++) {
    const site = sitesStore.getByPlanetNaturalIdOrName(parameters[i]);
    if (site) {
      sites.push(site);
    }
  }
  return sites;
}

export function getParameterShips(parameters: string[]) {
  let ships: PrunApi.Ship[] = [];
  if (parameters.length === 0 || parameters.some(isShipParameter)) {
    if (shipsStore.all.value === undefined) {
      return undefined;
    }
    ships = shipsStore.all.value;
  }
  return ships;
}

export function getPlanetRepairAge(siteId: string, now: number) {
  const site = sitesStore.getById(siteId);
  if (!site) {
    return undefined;
  }
  const buildings = site.platforms.filter(isRepairableBuilding);
  if (buildings.length === 0) {
    return undefined;
  }
  let maxAge = 0;
  for (const building of buildings) {
    const age = diffDays(getBuildingLastRepair(building), now, true);
    if (age > maxAge) {
      maxAge = age;
    }
  }
  return maxAge;
}

function isShipParameter(parameter: string) {
  const upper = parameter.toUpperCase();
  return upper === 'SHIP' || upper === 'SHIPS';
}
