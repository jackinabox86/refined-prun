import { describe, expect, it } from 'vitest';
import type { BurnValues, MaterialBurn } from '@src/core/burn';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { computeLowstrifeLoad, loadAmount, lowstrifePackage, lowstrifeRole } from './ship-loading';

const sizes: Record<string, { weight: number; volume: number }> = {
  AL: { weight: 2.7, volume: 1 },
  ALE: { weight: 0.1, volume: 0.1 },
  DW: { weight: 0.1, volume: 0.1 },
  EXO: { weight: 0.1, volume: 0.05 },
  HMS: { weight: 0.05, volume: 0.05 },
  KOM: { weight: 0.1, volume: 0.1 },
  LD: { weight: 0.001, volume: 0.01 },
  MED: { weight: 0.3, volume: 0.1 },
  PT: { weight: 0.25, volume: 0.2 },
  RAT: { weight: 0.21, volume: 0.1 },
  REP: { weight: 0.006, volume: 0.002 },
  SAL: { weight: 0.001, volume: 0.01 },
  SC: { weight: 0.04, volume: 0.01 },
  SCN: { weight: 0.001, volume: 0.001 },
  SI: { weight: 2.329, volume: 1 },
  SWF: { weight: 0.003, volume: 0.003 },
  TRN: { weight: 0.001, volume: 0.001 },
};

function mat(dailyAmount: number, inventory: number, type: MaterialBurn['type']): MaterialBurn {
  return {
    input: type === 'input' ? -dailyAmount : 0,
    output: type === 'output' ? dailyAmount : 0,
    workforce: type === 'workforce' ? -dailyAmount : 0,
    dailyAmount,
    remainingAllocation: 0,
    inventory,
    daysLeft: 0,
    type,
  };
}

// Rows of the owner's "Ship loading v2" sheet as exported on 2026-11-06.
const sheetBurn: BurnValues = {
  DW: mat(-42.5, 4280, 'workforce'),
  RAT: mat(-43, 174, 'workforce'),
  EXO: mat(-1.25, 7.21, 'workforce'),
  PT: mat(-1.25, 7.21, 'workforce'),
  MED: mat(-2, 10.3, 'workforce'),
  HMS: mat(-2, 10.2, 'workforce'),
  SCN: mat(-0.4, 4.67, 'workforce'),
  KOM: mat(-2.5, 12, 'workforce'),
  REP: mat(-0.5, 4.86, 'workforce'),
  ALE: mat(-4, 18.4, 'workforce'),
  SC: mat(-0.4, 4.64, 'workforce'),
  SWF: mat(705.5, 2070, 'output'),
  TRN: mat(235.2, 700, 'output'),
  AL: mat(-47.04, 889, 'input'),
  SI: mat(-47.04, 718, 'input'),
  LD: mat(2.52, 7, 'output'),
  SAL: mat(5.04, 15, 'output'),
};

const getMaterial = (ticker: string) => sizes[ticker];

describe('loadAmount', () => {
  it('rounds the shortfall up and adds one spare unit', () => {
    expect(loadAmount(-43, 174, 60)).toBe(2407);
  });

  it('loads nothing for produced or already stocked materials', () => {
    expect(loadAmount(705.5, 2070, 60)).toBe(0);
    expect(loadAmount(-42.5, 4280, 60)).toBe(0);
  });
});

describe('computeLowstrifeLoad', () => {
  it('reproduces the sheet output for its own inputs', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 60,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial,
    });
    // Sheet K4, K5 and K6.
    expect(result.materials).toEqual({
      DW: 3,
      RAT: 2407,
      EXO: 69,
      PT: 69,
      MED: 111,
      HMS: 111,
      SCN: 21,
      KOM: 139,
      REP: 27,
      ALE: 223,
      SC: 21,
      AL: 198,
      SI: 369,
    });
    expect(result.inputDays).toBeCloseTo(23.08, 2);
    expect(result.dwFill).toBe(3);
    expect(result.weight).toBeCloseTo(1999.99, 2);
    expect(result.volume).toBeCloseTo(878.4, 1);
    expect(result.fits).toBe(true);
  });

  it('loads consumables for the fixed days regardless of the ship size', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 60,
      maxWeight: 100,
      maxVolume: 100,
      getMaterial,
    });
    expect(result.materials.RAT).toBe(2407);
    expect(result.inputDays).toBe(0);
    expect(result.materials.AL).toBeUndefined();
    expect(result.dwFill).toBe(0);
    expect(result.fits).toBe(false);
  });

  it('reports no input days when the planet consumes only workforce needs', () => {
    const result = computeLowstrifeLoad({
      burn: { RAT: sheetBurn.RAT, DW: sheetBurn.DW },
      consumableDays: 10,
      maxWeight: 500,
      maxVolume: 500,
      getMaterial,
    });
    expect(result.inputDays).toBeUndefined();
    expect(result.materials.RAT).toBe(257);
    expect(result.dwFill).toBe(0);
  });
});

describe('mixed consumables and inputs', () => {
  // RAT on a FIM base: 10/day for the workforce, 20/day into production.
  const ratForFim: MaterialBurn = {
    ...mat(-30, 0, 'input'),
    input: 20,
    workforce: 10,
  };

  it('loads the workforce share for the consumable days and the rest for the input days', () => {
    expect(lowstrifeRole(ratForFim)).toBe('both');
    const result = computeLowstrifeLoad({
      burn: { RAT: ratForFim },
      consumableDays: 60,
      maxWeight: 0.21 * 1000,
      maxVolume: 1000,
      getMaterial,
    });
    // 600 for the workforce, then 20/day until 1000 units: 19.95 days.
    expect(result.inputDays).toBeCloseTo(19.95, 2);
    expect(result.materials.RAT).toBe(1000);
  });

  it('keeps net loading for a material the planet also produces', () => {
    expect(lowstrifeRole({ ...ratForFim, output: 5, dailyAmount: -25 })).toBe('consumable');
  });
});

describe('production days', () => {
  const base = (baseSpace: { weight: number; volume: number }, consumableDays = 30) =>
    computeLowstrifeLoad({
      burn: {
        RAT: mat(-10, 0, 'workforce'),
        AL: mat(-10, 0, 'input'),
        SI: mat(20, 0, 'output'),
      },
      consumableDays,
      maxWeight: 100,
      maxVolume: 100,
      baseSpace,
      getMaterial,
    });

  it('measures the outputs against the base space left after the consumables', () => {
    // Consumables: 301 RAT = 63.21t. Outputs: 46.58t/day into 936.79t = 20.11 days.
    const result = base({ weight: 1000, volume: 1000 });
    expect(result.productionLimit).toBe('outputs');
    expect(result.productionDays).toBe(20.1);
  });

  it('ignores the ship limits', () => {
    // The 100t ship holds a fraction of these days; the base space alone sets them.
    expect(base({ weight: 1000, volume: 1000 }).productionDays).toBeGreaterThan(2);
  });

  it('is limited by the inputs when they take more space than the outputs', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 60,
      maxWeight: 2000,
      maxVolume: 2000,
      baseSpace: { weight: 3000, volume: 3000 },
      getMaterial,
    });
    // AL + SI: 236.56t/day. Consumables at 60 days: 605.69t. (3000 - 605.69) / 236.56 = 10.12.
    expect(result.productionLimit).toBe('inputs');
    expect(result.productionDays).toBe(10.1);
  });

  it('shrinks when the consumable days grow', () => {
    const space = { weight: 1000, volume: 1000 };
    expect(base(space, 10).productionDays!).toBeGreaterThan(base(space, 40).productionDays!);
  });

  it('is zero when the consumables alone fill the base', () => {
    expect(base({ weight: 50, volume: 1000 }).productionDays).toBe(0);
  });

  it('is undefined without the base space', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 60,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial,
    });
    expect(result.productionDays).toBeUndefined();
  });

  it('is undefined when the planet neither consumes inputs nor produces', () => {
    const result = computeLowstrifeLoad({
      burn: { RAT: sheetBurn.RAT },
      consumableDays: 10,
      maxWeight: 500,
      maxVolume: 500,
      baseSpace: { weight: 1000, volume: 1000 },
      getMaterial,
    });
    expect(result.productionDays).toBeUndefined();
  });
});

describe('DW fill', () => {
  it('is skipped when the inputs are capped at the consumable days', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 10,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial,
    });
    expect(result.inputDays).toBe(10);
    expect(result.dwFill).toBe(0);
    expect(result.weight).toBeLessThan(2000);
  });

  it('fits a fill that lands exactly on the limit despite float residue', () => {
    // A reported Sand load: GRN 108 + H2O 9453 + DW 14 sums to 2000.0000000000002m³.
    const result = computeLowstrifeLoad({
      burn: {
        DW: {
          input: 0,
          output: 1900,
          workforce: 77,
          dailyAmount: 1823,
          remainingAllocation: 0,
          inventory: 1201,
          daysLeft: 0,
          type: 'workforce',
        },
        GRN: mat(-22.96, 124, 'input'),
        H2O: mat(-2725.2, 17882, 'input'),
      },
      consumableDays: 60,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial: ticker =>
        ({
          DW: { weight: 0.1, volume: 0.1 },
          GRN: { weight: 0.9, volume: 1 },
          H2O: { weight: 0.2, volume: 0.2 },
        })[ticker],
    });
    expect(result.materials).toEqual({ GRN: 108, H2O: 9453, DW: 14 });
    expect(result.volume).toBeGreaterThan(2000);
    expect(result.fits).toBe(true);
  });
});

describe('zero consumable days', () => {
  const zeroDays = (burn: BurnValues) =>
    computeLowstrifeLoad({
      burn,
      consumableDays: 0,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial,
    });

  it('fills the ship with inputs and tops up the remainder with DW', () => {
    const result = zeroDays(sheetBurn);
    // No consumables, so AL + SI take the whole 2000t: more days than the sheet's 23.08,
    // and uncapped by the zero consumable days.
    expect(result.inputDays).toBeCloseTo(25.63, 2);
    expect(result.materials.RAT).toBeUndefined();
    expect(result.materials.AL).toBeGreaterThan(0);
    expect(result.materials.SI).toBeGreaterThan(0);
    expect(result.dwFill).toBeGreaterThan(0);
    // The DW only covers what one more fit step of inputs could not.
    expect(result.dwFill * sizes.DW.weight).toBeLessThan(236.56 * 0.01 + 2.7 + 2.329);
    expect(result.weight).toBeCloseTo(2000, 0);
    expect(result.fits).toBe(true);
  });

  it('loads nothing without inputs', () => {
    const result = zeroDays({ RAT: sheetBurn.RAT, DW: sheetBurn.DW });
    expect(result.inputDays).toBeUndefined();
    expect(result.materials).toEqual({});
    expect(result.dwFill).toBe(0);
  });

  it('skips the DW fill when DW is excluded', () => {
    const result = computeLowstrifeLoad({
      burn: sheetBurn,
      consumableDays: 0,
      maxWeight: 2000,
      maxVolume: 2000,
      getMaterial,
      excludeDwFill: true,
    });
    expect(result.dwFill).toBe(0);
    expect(result.materials.DW).toBeUndefined();
  });
});

describe('lowstrifePackage', () => {
  it('builds one MTRA of a Manual group into the ship cargo, flying to the planet', () => {
    const pkg = lowstrifePackage({
      planetName: 'Hortus',
      planetNaturalId: 'VH-331a',
      shipName: 'ace',
      materials: { RAT: 5 },
    });
    expect(pkg.groups).toEqual([{ type: 'Manual', name: 'Item xfer', materials: { RAT: 5 } }]);
    expect(pkg.actions).toEqual([
      {
        type: 'MTRA',
        name: 'MTRA',
        group: 'Item xfer',
        origin: configurableValue,
        dest: 'ace Cargo',
        sfcDestination: 'VH-331a',
      },
    ]);
  });

  it('leaves the SFC destination unset without a planet', () => {
    const pkg = lowstrifePackage({
      planetName: '',
      planetNaturalId: undefined,
      shipName: 'ace',
      materials: {},
    });
    expect(pkg.actions[0]).not.toHaveProperty('sfcDestination');
  });
});
