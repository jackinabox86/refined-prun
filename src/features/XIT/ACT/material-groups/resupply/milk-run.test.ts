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
});
