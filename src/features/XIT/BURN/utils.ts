import { getMinDaysLeft, PlanetBurn } from '@src/core/burn';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { sortMaterials } from '@src/core/sort-materials';
import { fixed0, fixed01 } from '@src/utils/format';
import { userData } from '@src/store/user-data';

export function getSortedTickers(burn: PlanetBurn) {
  const materials = Object.keys(burn.burn).map(materialsStore.getByTicker);
  return sortMaterials(materials.filter(x => x !== undefined));
}

export const countDays = getMinDaysLeft;

export function formatBurnDays(days: number) {
  if (days > 999) {
    return '∞';
  }
  if (days >= 10) {
    return fixed0(Math.floor(days));
  }
  return fixed01(days);
}

export function burnDaysClass(days: number) {
  const flooredDays = Math.floor(days);
  return {
    [C.Workforces.daysMissing]: flooredDays <= userData.settings.burn.red,
    [C.Workforces.daysWarning]: flooredDays <= userData.settings.burn.yellow,
    [C.Workforces.daysSupplied]: flooredDays > userData.settings.burn.yellow,
  };
}
