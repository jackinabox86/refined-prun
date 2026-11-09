import type { BurnValues, MaterialBurn } from '@src/core/burn';
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
  // Skips the DW fill, for a user who supplies DW separately. The fill is also skipped
  // when the inputs are capped at the consumable days or the planet has no inputs.
  excludeDwFill?: boolean;
  // Total capacity of the base store. Production days are measured against it.
  baseSpace?: LowstrifeMaterialSize;
}

export interface LowstrifeLoad {
  materials: Record<string, number>;
  // Days of production inputs that fit next to the consumables, capped at the consumable
  // days. Undefined when the planet consumes no production inputs.
  inputDays: number | undefined;
  // Days of production inputs, or of outputs, that fit in the base store once the
  // consumables are dropped off, to the tenth; the larger daily side sets it. Undefined
  // without the base space, or when the planet neither consumes inputs nor produces.
  productionDays: number | undefined;
  // The side that limits productionDays.
  productionLimit: 'inputs' | 'outputs' | undefined;
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

export type LowstrifeRole = 'consumable' | 'input' | 'both';

// A material the planet both feeds its workforce and feeds into production (RAT on a
// FIM base) loads its workforce share for the consumable days and its production share
// for the input days. Materials the planet also produces keep loading their net shortfall
// for a single duration, since their output covers part of either need.
export function lowstrifeRole(mat: MaterialBurn): LowstrifeRole {
  if (mat.workforce > 0 && mat.input > 0 && mat.output <= 0) {
    return 'both';
  }
  return mat.workforce > 0 ? 'consumable' : 'input';
}

function materialLoad(mat: MaterialBurn, consumableDays: number, inputDays: number) {
  const role = lowstrifeRole(mat);
  if (role !== 'both') {
    return loadAmount(
      mat.dailyAmount,
      mat.inventory,
      role === 'consumable' ? consumableDays : inputDays,
    );
  }
  const need = mat.workforce * consumableDays + mat.input * inputDays - mat.inventory;
  return need > 0 ? Math.ceil(need) + 1 : 0;
}

// Production days are floored to the tenth.
function toTenth(days: number) {
  return Math.floor(Number((days * 10).toFixed(6))) / 10;
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
  const hasInputs = Object.values(burn).some(
    mat => lowstrifeRole(mat) !== 'consumable' && mat.dailyAmount < 0,
  );

  const load = (inputDays: number) => {
    const materials: Record<string, number> = {};
    for (const ticker of Object.keys(burn)) {
      const amount = materialLoad(burn[ticker], consumableDays, inputDays);
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

  // Inputs never load for longer than the consumables, so a roomy ship keeps spare space.
  const inputDays = hasInputs
    ? Math.min(
        consumableDays,
        maxFittingDays(days => fits(load(days))),
      )
    : undefined;
  const materials = load(inputDays ?? 0);

  // The base keeps the dropped-off consumables, and the rest of its capacity holds
  // production inputs or outputs, so the bulkier side sets the production days.
  let productionDays: number | undefined;
  let productionLimit: LowstrifeLoad['productionLimit'];
  if (input.baseSpace) {
    const consumables = totals(load(0), getMaterial);
    const room = {
      weight: input.baseSpace.weight - consumables.weight,
      volume: input.baseSpace.volume - consumables.volume,
    };
    const daysOf = (perDay: Record<string, number>) => {
      const t = totals(perDay, getMaterial);
      if (t.weight <= 0 && t.volume <= 0) {
        return undefined;
      }
      const days = Math.min(
        t.weight > 0 ? room.weight / t.weight : Infinity,
        t.volume > 0 ? room.volume / t.volume : Infinity,
      );
      return Math.max(0, days);
    };
    const inputsPerDay: Record<string, number> = {};
    const outputsPerDay: Record<string, number> = {};
    for (const [ticker, mat] of Object.entries(burn)) {
      const role = lowstrifeRole(mat);
      if (mat.dailyAmount > 0) {
        outputsPerDay[ticker] = mat.dailyAmount;
      } else if (role === 'both') {
        inputsPerDay[ticker] = mat.input;
      } else if (role === 'input' && mat.dailyAmount < 0) {
        inputsPerDay[ticker] = -mat.dailyAmount;
      }
    }
    const inputSide = daysOf(inputsPerDay);
    const outputSide = daysOf(outputsPerDay);
    if (inputSide !== undefined && (outputSide === undefined || inputSide <= outputSide)) {
      productionDays = toTenth(inputSide);
      productionLimit = 'inputs';
    } else if (outputSide !== undefined) {
      productionDays = toTenth(outputSide);
      productionLimit = 'outputs';
    }
  }

  // DW only tops up a ship the inputs fill. Inputs capped at the consumable days, or no
  // inputs at all, leave room the visit does not need, and DW there is just excess water.
  const inputsCapped = inputDays === undefined || inputDays >= consumableDays;
  let dwFill = 0;
  const dw = input.excludeDwFill || inputsCapped ? undefined : getMaterial('DW');
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
    productionDays,
    productionLimit,
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
