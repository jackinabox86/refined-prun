import type { BurnValues } from '@src/core/burn';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { maxFittingDays } from '@src/features/XIT/ACT/material-groups/resupply/fit-days';

export interface LowstrifeMaterialSize {
  weight: number;
  volume: number;
}

export interface LowstrifeInput {
  burn: BurnValues;
  // Workforce consumables are always loaded for this many days.
  consumableDays: number;
  maxWeight: number;
  maxVolume: number;
  getMaterial: (ticker: string) => LowstrifeMaterialSize | undefined;
}

export interface LowstrifeLoad {
  materials: Record<string, number>;
  // Days of production inputs that fit next to the consumables. Undefined when the
  // planet consumes no production inputs.
  inputDays: number | undefined;
  dwFill: number;
  weight: number;
  volume: number;
  fits: boolean;
}

export const lowstrifeGroupName = 'Item xfer';

// Units to load so `days` of net consumption are covered, plus one spare unit.
// Zero for materials the planet does not net-consume or already holds enough of.
export function loadAmount(dailyAmount: number, inventory: number, days: number) {
  if (dailyAmount >= 0) {
    return 0;
  }
  const need = -dailyAmount * days - inventory;
  return need > 0 ? Math.ceil(need) + 1 : 0;
}

function totals(materials: Record<string, number>, getMaterial: LowstrifeInput['getMaterial']) {
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(materials)) {
    const size = getMaterial(ticker);
    if (size) {
      weight += size.weight * amount;
      volume += size.volume * amount;
    }
  }
  return { weight, volume };
}

// Ports the "Ship loading v2" sheet: consumables for a fixed number of days, production
// inputs for the most days that still fit the ship, then the spare room filled with DW.
export function computeLowstrifeLoad(input: LowstrifeInput): LowstrifeLoad {
  const { burn, consumableDays, maxWeight, maxVolume, getMaterial } = input;
  const isConsumable = (ticker: string) => burn[ticker].workforce > 0;
  const hasInputs = Object.keys(burn).some(
    ticker => !isConsumable(ticker) && burn[ticker].dailyAmount < 0,
  );

  const load = (inputDays: number) => {
    const materials: Record<string, number> = {};
    for (const ticker of Object.keys(burn)) {
      const mat = burn[ticker];
      const days = isConsumable(ticker) ? consumableDays : inputDays;
      const amount = loadAmount(mat.dailyAmount, mat.inventory, days);
      if (amount > 0) {
        materials[ticker] = amount;
      }
    }
    return materials;
  };

  const fits = (materials: Record<string, number>) => {
    const t = totals(materials, getMaterial);
    return t.weight <= maxWeight && t.volume <= maxVolume;
  };

  const inputDays = hasInputs ? maxFittingDays(days => fits(load(days))) : undefined;
  const materials = load(inputDays ?? 0);

  let dwFill = 0;
  const dw = getMaterial('DW');
  if (dw) {
    const t = totals(materials, getMaterial);
    const room = Math.min((maxWeight - t.weight) / dw.weight, (maxVolume - t.volume) / dw.volume);
    // Rounding first keeps float residue like 2.9999999 from dropping a whole unit.
    dwFill = Math.max(0, Math.floor(Number(room.toFixed(6))));
    if (dwFill > 0) {
      materials.DW = (materials.DW ?? 0) + dwFill;
    }
  }

  const t = totals(materials, getMaterial);
  return {
    materials,
    inputDays,
    dwFill,
    weight: t.weight,
    volume: t.volume,
    fits: t.weight <= maxWeight && t.volume <= maxVolume,
  };
}

// The sheet's output: one MTRA of a Manual group into the ship's cargo. The origin is
// left configurable instead of the sheet's hard-coded warehouse.
export function lowstrifePackage(args: {
  planetName: string;
  shipName: string | undefined;
  materials: Record<string, number>;
}): UserData.ActionPackageData {
  return {
    global: { name: `LOWSTRIFE: ${args.planetName}` },
    groups: [{ type: 'Manual', name: lowstrifeGroupName, materials: args.materials }],
    actions: [
      {
        type: 'MTRA',
        name: 'MTRA',
        group: lowstrifeGroupName,
        origin: configurableValue,
        dest: args.shipName ? `${args.shipName} Cargo` : configurableValue,
      },
    ],
  };
}
