import { describe, expect, it } from 'vitest';
import { heldStock, withoutReserve } from '@src/features/XIT/ROUTE/route-reserve';

describe('withoutReserve', () => {
  it('leaves only stock above the route floor for other buys', () => {
    expect(withoutReserve({ RAT: 100, DW: 30, SF: 50 }, { RAT: 60, DW: 30, SF: 80 })).toEqual({
      RAT: 40,
    });
  });

  it('passes stock through when no route loads at this exchange', () => {
    expect(withoutReserve({ RAT: 100 }, undefined)).toEqual({ RAT: 100 });
  });
});

describe('heldStock', () => {
  it('holds the reserve, capped by what the warehouse has', () => {
    // A burn buy after laps have loaded only stops drawing the rest down; it never refills the floor.
    expect(heldStock({ RAT: 20, DW: 50 }, { RAT: 60, DW: 30, OVE: 5 })).toEqual({
      RAT: 20,
      DW: 30,
    });
  });
});
