import { describe, expect, it } from 'vitest';
import {
  CargoAmount,
  cargoFitsStore,
  getCargoSnapshot,
  getUnloadedCargo,
  isUnloadTransferEligible,
  storeContainsCargo,
} from './unload-plan';

const cargo: CargoAmount[] = [{ ticker: 'RAT', amount: 10, weight: 1, volume: 2 }];

describe('warehouse unload eligibility', () => {
  const eligible = {
    shiftKey: true,
    landedAtPlanet: true,
    hasBaseStore: true,
    hasWarehouseStore: true,
    hasCargo: true,
    inProgress: false,
  };

  it('requires a shift-click', () => {
    expect(isUnloadTransferEligible({ ...eligible, shiftKey: false })).toBe(false);
  });

  it('does not apply to station or CX landings', () => {
    expect(isUnloadTransferEligible({ ...eligible, landedAtPlanet: false })).toBe(false);
  });

  it('requires both the local base store and matching warehouse', () => {
    expect(isUnloadTransferEligible({ ...eligible, hasBaseStore: false })).toBe(false);
    expect(isUnloadTransferEligible({ ...eligible, hasWarehouseStore: false })).toBe(false);
  });

  it('ignores empty and already-running unloads', () => {
    expect(isUnloadTransferEligible({ ...eligible, hasCargo: false })).toBe(false);
    expect(isUnloadTransferEligible({ ...eligible, inProgress: true })).toBe(false);
  });

  it('accepts a shift-click with a complete local destination', () => {
    expect(isUnloadTransferEligible(eligible)).toBe(true);
  });
});

describe('warehouse unload cargo planning', () => {
  it('snapshots inventory cargo and combines duplicate tickers', () => {
    expect(
      getCargoSnapshot({
        items: [
          { quantity: { material: { ticker: 'RAT', weight: 1, volume: 2 }, amount: 4 } },
          { quantity: { material: { ticker: 'RAT', weight: 1, volume: 2 }, amount: 6 } },
          { quantity: null },
        ],
      }),
    ).toEqual(cargo);
  });

  it('transfers only the amount removed by the native unload', () => {
    const before = [...cargo, { ticker: 'DW', amount: 5, weight: 0.1, volume: 0.1 }];
    const after = [
      { ...cargo[0]!, amount: 3 },
      { ticker: 'DW', amount: 5, weight: 0.1, volume: 0.1 },
    ];

    expect(getUnloadedCargo(before, after)).toEqual([
      { ticker: 'RAT', amount: 7, weight: 1, volume: 2 },
    ]);
  });

  it('does nothing when the native unload does not change cargo', () => {
    expect(getUnloadedCargo(cargo, cargo)).toEqual([]);
  });

  it('requires the full unloaded cargo to remain in the base store', () => {
    const base = {
      items: [{ quantity: { material: { ticker: 'RAT', weight: 1, volume: 2 }, amount: 10 } }],
    };
    expect(storeContainsCargo(base, cargo)).toBe(true);
    expect(storeContainsCargo(base, [{ ...cargo[0]!, amount: 11 }])).toBe(false);
  });

  it('requires the complete unloaded cargo to fit the warehouse', () => {
    const warehouse = {
      weightCapacity: 20,
      weightLoad: 10,
      volumeCapacity: 30,
      volumeLoad: 10,
    };
    expect(cargoFitsStore(warehouse, cargo)).toBe(true);
    expect(cargoFitsStore({ ...warehouse, volumeLoad: 11 }, cargo)).toBe(false);
  });
});
