import { describe, expect, it } from 'vitest';
import { FIT_DAY_MAX, FIT_DAY_STEP, maxFittingDays } from './fit-days';
import {
  MilkRunCargo,
  MilkRunInput,
  MilkRunStop,
  planMilkRun,
  subtractMaterials,
  takeableAmount,
} from './milk-run';

const sizes: Record<string, { weight: number; volume: number }> = {
  RAT: { weight: 1, volume: 1 },
  DW: { weight: 1, volume: 1 },
  A: { weight: 1, volume: 1 },
  B: { weight: 1, volume: 1 },
  FE: { weight: 1, volume: 1 },
};

const sizeOf = (ticker: string) => sizes[ticker];

const cargo = (capacity: number, load = 0): MilkRunCargo => ({
  weightLoad: load,
  volumeLoad: load,
  weightCapacity: capacity,
  volumeCapacity: capacity,
});

function stop(partial: Omit<MilkRunStop, 'dailyAmount' | 'storeQty'> & Partial<MilkRunStop>) {
  return {
    storeQty: {},
    dailyAmount: {},
    ...partial,
  };
}

function plan(
  stops: MilkRunStop[],
  hold: MilkRunCargo = cargo(1000),
): ReturnType<typeof planMilkRun> {
  const input: MilkRunInput = { stops, cargo: hold, sizeOf };
  return planMilkRun(input);
}

function sumRecords(records: Record<string, number>[]) {
  const result: Record<string, number> = {};
  for (const record of records) {
    for (const [ticker, amount] of Object.entries(record)) {
      result[ticker] = (result[ticker] ?? 0) + amount;
    }
  }
  return result;
}

describe('planMilkRun', () => {
  it('nets a later stop against earlier surplus; consumer bill stays, CX buy drops', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { DW: 5 },
      storeQty: { RAT: 20 },
      dailyAmount: { RAT: 2, DW: -1 },
    });
    const consumer = stop({
      id: 'B',
      days: 10,
      bill: { RAT: 8 },
      dailyAmount: { RAT: -1 },
    });

    const result = plan([source, consumer]);

    expect(consumer.bill).toEqual({ RAT: 8 });
    expect(result.sourced).toEqual({ RAT: 8 });
    expect(result.pickupsByStop.get('A')).toEqual({ RAT: 8 });
    expect(result.sourcedByConsumer.get('B')).toEqual({ RAT: 8 });
    expect(subtractMaterials(consumer.bill, result.sourcedByConsumer.get('B')!)).toEqual({});

    const bills = sumRecords([source.bill, consumer.bill]);
    const pickups = sumRecords([...result.pickupsByStop.values()]);
    expect(sumRecords([subtractMaterials(bills, pickups), pickups])).toEqual(bills);
  });

  it('yields takeable 0 when the store covers the later need but not the source horizon', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { DW: 3 },
      storeQty: { RAT: 8 },
      dailyAmount: { RAT: -0.8 },
    });
    expect(takeableAmount(source, 'RAT')).toBe(0);

    const consumer = stop({
      id: 'B',
      days: 10,
      bill: { RAT: 5 },
      dailyAmount: { RAT: -0.4 },
    });
    const result = plan([source, consumer]);
    expect(result.transfers).toEqual([]);
    expect(result.sourced).toEqual({});
  });

  it('never sources a ticker that is on the source bill', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { RAT: 2 },
      storeQty: { RAT: 40 },
      dailyAmount: { RAT: -0.1 },
    });
    const consumer = stop({
      id: 'B',
      days: 10,
      bill: { RAT: 5 },
    });
    expect(takeableAmount(source, 'RAT')).toBe(0);
    expect(plan([source, consumer]).sourced).toEqual({});
  });

  it('decrements the ledger so a second stop only gets the remainder', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { DW: 1 },
      storeQty: { RAT: 11 },
      dailyAmount: { RAT: 1 },
    });
    expect(takeableAmount(source, 'RAT')).toBe(10);

    const first = stop({ id: 'B', days: 10, bill: { RAT: 6 } });
    const second = stop({ id: 'C', days: 10, bill: { RAT: 6 } });
    const result = plan([source, first, second]);

    expect(result.sourcedByConsumer.get('B')).toEqual({ RAT: 6 });
    expect(result.sourcedByConsumer.get('C')).toEqual({ RAT: 4 });
    expect(result.pickupsByStop.get('A')).toEqual({ RAT: 10 });
  });

  it('detects a mid-route peak after stop 1 when departure still fits', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { A: 10 },
      storeQty: { B: 50 },
      dailyAmount: { B: 4 },
    });
    const consumer = stop({
      id: 'B',
      days: 10,
      bill: { B: 60 },
    });
    const result = plan([source, consumer], cargo(50));

    expect(result.sourced).toEqual({ B: 49 });
    expect(result.fits).toBe(false);
    expect(result.firstOverflow?.stopId).toBe('A');
    expect(result.firstOverflow?.weightOver).toBe(10);
    expect(result.firstOverflow?.volumeOver).toBe(10);
  });

  it('keeps a burn-less stop as a consumer but never as a source', () => {
    // Shape planBasesMilkRun builds for a repair-only base whose burn data has not
    // loaded: bill known, store quantities and daily rates unknown.
    const noBurn = stop({ id: 'A', days: 10, bill: { A: 40 } });
    const consumer = stop({ id: 'B', days: 10, bill: { B: 20 } });

    expect(takeableAmount(noBurn, 'B')).toBe(0);

    const result = plan([noBurn, consumer], cargo(50));
    expect(result.transfers).toEqual([]);
    // Its bill still counts against capacity — dropping the stop hides the overflow.
    expect(result.fits).toBe(false);
    expect(result.firstOverflow?.stopId).toBeUndefined();
    expect(result.firstOverflow?.weightOver).toBe(10);
    expect(plan([consumer], cargo(50)).fits).toBe(true);
  });

  it('hands maxFittingDays a monotonic fits predicate', () => {
    function fits(days: number) {
      const source = stop({
        id: 'A',
        days,
        bill: { DW: Math.max(0, Math.ceil(days * 0.5 + 1)) },
        storeQty: { RAT: 40 },
        dailyAmount: { RAT: 3, DW: -0.5 },
      });
      const consumer = stop({
        id: 'B',
        days,
        bill: { RAT: Math.max(0, Math.ceil(days * 2 + 1)) },
        dailyAmount: { RAT: -2 },
      });
      return plan([source, consumer], cargo(30)).fits;
    }

    const fitted = maxFittingDays(fits);
    expect(fitted).toBeGreaterThan(0);
    expect(fitted).toBeLessThan(FIT_DAY_MAX);
    expect(fits(fitted)).toBe(true);
    expect(fits(Number((fitted + FIT_DAY_STEP).toFixed(2)))).toBe(false);

    let seenFalse = false;
    let flippedTrue = false;
    for (let units = 0; units <= 2000; units++) {
      const days = Number((units * FIT_DAY_STEP).toFixed(2));
      const ok = fits(days);
      if (seenFalse && ok) {
        flippedTrue = true;
      }
      if (!ok) {
        seenFalse = true;
      }
    }
    expect(seenFalse).toBe(true);
    expect(flippedTrue).toBe(false);
  });

  it('counts a stop output that no later stop bills for against peak load', () => {
    const source = stop({
      id: 'A',
      days: 10,
      bill: { DW: 5 },
      storeQty: { FE: 50 },
      dailyAmount: { FE: 4 },
    });
    const consumer = stop({
      id: 'B',
      days: 10,
      bill: { RAT: 10 },
    });
    expect(takeableAmount(source, 'FE')).toBe(49);
    expect(plan([source, consumer]).sourced).toEqual({});

    // Planned walk loads only sourcing transfers (none here): after A = 10, fits.
    // Surplus walk loads takeable FE 49: after A = 59, 19 over — warn, do not block.
    const warned = plan([source, consumer], cargo(40));
    expect(warned.fits).toBe(true);
    expect(warned.overflows).toEqual([]);
    expect(warned.surplusOverflows[0]?.stopId).toBe('A');
    expect(warned.surplusOverflows[0]?.weightOver).toBe(19);
    expect(warned.surplusOverflows[0]?.volumeOver).toBe(19);

    const stillFits = plan([source, consumer], cargo(80));
    expect(stillFits.fits).toBe(true);
    expect(stillFits.overflows).toEqual([]);
    expect(stillFits.surplusOverflows).toEqual([]);
  });

  it('never under-reports a stop that already overflows on planned load', () => {
    // Surplus load is the planned load plus the untaken remainder, so the advisory
    // walk always carries a larger overage at such a stop. DISPATCH still shows the
    // planned figure there: that is the amount the user has to shed before EXECUTE
    // re-enables, and the surplus figure would overstate it.
    const source = stop({
      id: 'A',
      days: 10,
      bill: {},
      storeQty: { B: 50, FE: 200 },
      dailyAmount: { B: 0, FE: 0 },
    });
    const consumer = stop({ id: 'B', days: 10, bill: { B: 60 } });
    const result = plan([source, consumer], cargo(50));

    expect(result.sourced).toEqual({ B: 49 });
    expect(result.overflows).toHaveLength(1);
    expect(result.overflows[0]!.stopId).toBe('A');
    expect(result.overflows[0]!.weightOver).toBe(10);

    const surplusAtA = result.surplusOverflows.find(x => x.stopId === 'A');
    expect(surplusAtA?.weightOver).toBeGreaterThan(result.overflows[0]!.weightOver);
  });
});
