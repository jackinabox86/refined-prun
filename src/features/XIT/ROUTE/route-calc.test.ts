import { describe, expect, it } from 'vitest';
import {
  cumulativeSecondsBeforeStop,
  formatFuelCell,
  fuelCargoLoads,
  legPayloads,
  maxDaysAtStep,
  minAdjustedBurn,
  padLegSeconds,
  planRouteTanks,
  planSegmentTanks,
  planTank,
  routeSupplyDays,
  snapDays,
  transitStopIds,
  waitSeconds,
} from '@src/features/XIT/ROUTE/route-calc';

describe('padLegSeconds', () => {
  it('uses two hours when that exceeds 25 percent', () => {
    expect(padLegSeconds(3600)).toBe(3600 + 2 * 60 * 60);
  });

  it('uses 25 percent when that exceeds two hours', () => {
    expect(padLegSeconds(10 * 60 * 60)).toBe(12.5 * 60 * 60);
  });
});

describe('minAdjustedBurn', () => {
  it('subtracts padded flight time after the first leg and keeps the lowest base', () => {
    const padded = [86400, 43200, 86400];
    expect(cumulativeSecondsBeforeStop(padded, 0)).toBe(0);
    expect(cumulativeSecondsBeforeStop(padded, 1)).toBe(0);
    expect(cumulativeSecondsBeforeStop(padded, 2)).toBe(43200);
    expect(minAdjustedBurn([10, undefined, 10], padded)).toBe(9.5);
  });

  it('returns undefined when no base has a burn figure', () => {
    expect(minAdjustedBurn([undefined, undefined], [])).toBeUndefined();
  });
});

describe('planTank', () => {
  it('leaves a tank alone when every arrival stays at or above 20 percent', () => {
    expect(planTank(100, [10, 10])).toEqual([
      { level: 100, refuel: false, loaded: 0 },
      { level: 90, refuel: false, loaded: 0 },
      { level: 80, refuel: false, loaded: 0 },
    ]);
  });

  it('tops up the preceding stop only enough to finish at 20 percent', () => {
    const stops = planTank(100, [50, 50]);
    expect(stops[1]).toEqual({ level: 50, refuel: true, loaded: 20 });
    expect(stops[2]).toEqual({ level: 20, refuel: false, loaded: 0 });
  });

  it('flags a full origin that still cannot cover the first leg', () => {
    expect(planTank(100, [90])[0]).toEqual({ level: 100, refuel: true, loaded: 0 });
  });

  it('refuels again after a fill that cannot cover the remaining route', () => {
    const stops = planTank(100, [40, 70, 70]);
    expect(stops[1]).toEqual({ level: 60, refuel: true, loaded: 40 });
    expect(stops[2]).toEqual({ level: 30, refuel: true, loaded: 60 });
    expect(stops[3]).toEqual({ level: 20, refuel: false, loaded: 0 });
  });

  it('tracks STL and FTL independently and keeps origin fuel out of the cargo', () => {
    const tanks = planRouteTanks(100, 100, [
      { ok: true, stl: 50, ftl: 10 },
      { ok: true, stl: 50, ftl: 10 },
    ]);
    expect(tanks.stl[1]?.refuel).toBe(true);
    expect(tanks.ftl[1]?.refuel).toBe(false);
    expect(formatFuelCell(tanks.stl[1], tanks.ftl[1])).toBe('refuel');
    expect(fuelCargoLoads(tanks.stl, tanks.ftl)[0]).toEqual({ stl: 0, ftl: 0 });
    expect(fuelCargoLoads(tanks.stl, tanks.ftl)[1]).toEqual({ stl: 20, ftl: 0 });
  });

  it('plans a single origin as one route and refills at each later origin', () => {
    const legs = [
      { ok: true, stl: 50, ftl: 10 },
      { ok: true, stl: 50, ftl: 10 },
      { ok: true, stl: 40, ftl: 0 },
    ];
    const whole = planRouteTanks(100, 100, legs.slice(0, 2));
    const one = planSegmentTanks(100, 100, legs.slice(0, 2), [0]);
    expect(one.stl).toEqual(whole.stl);
    expect(one.ftl).toEqual(whole.ftl);
    const split = planSegmentTanks(100, 100, legs, [0, 2]);
    expect(split.stl[2]).toEqual({ level: 100, refuel: false, loaded: 0 });
    expect(fuelCargoLoads(split.stl, split.ftl, [0, 2])[0]).toEqual({ stl: 0, ftl: 0 });
    expect(fuelCargoLoads(split.stl, split.ftl, [0, 2])[2]).toEqual({ stl: 0, ftl: 0 });
    expect(fuelCargoLoads(split.stl, split.ftl, [0, 2])[1]).toEqual({ stl: 20, ftl: 0 });
  });

  it('returns an empty tank when the ship has no capacity', () => {
    expect(planTank(0, [5])).toEqual([
      { level: 0, refuel: false, loaded: 0 },
      { level: 0, refuel: false, loaded: 0 },
    ]);
  });
});

describe('route days', () => {
  it('snaps an unset duration to the 0.1 day step and keeps a stored value', () => {
    expect(routeSupplyDays(undefined, 90000)).toBe(1);
    expect(routeSupplyDays(2.2, 0)).toBe(2.2);
    expect(snapDays(1.26)).toBe(1.3);
  });

  it('adds a persisted wait to the duration and ignores an empty one', () => {
    expect(waitSeconds(undefined)).toBe(0);
    expect(waitSeconds({ amount: 0, unit: 'days' })).toBe(0);
    expect(waitSeconds({ amount: 2, unit: 'hours' })).toBe(2 * 60 * 60);
    expect(routeSupplyDays(undefined, 86400 + waitSeconds({ amount: 1, unit: 'days' }))).toBe(2);
  });

  it('fits the largest 0.1 day step that still passes', () => {
    expect(maxDaysAtStep(days => days <= 0.3)).toBe(0.3);
    expect(maxDaysAtStep(() => false)).toBe(0);
    expect(maxDaysAtStep(() => true)).toBe(999);
  });
});

describe('transitStopIds', () => {
  const stops = [{ id: 'ANT' }, { id: 'XG-123' }];

  it('appends the origin when loop is on or unset', () => {
    expect(transitStopIds(stops, undefined)).toEqual(['ANT', 'XG-123', 'ANT']);
    expect(transitStopIds(stops, true)).toEqual(['ANT', 'XG-123', 'ANT']);
  });

  it('leaves the saved order alone when loop is off', () => {
    expect(transitStopIds(stops, false)).toEqual(['ANT', 'XG-123']);
  });
});

describe('legPayloads', () => {
  const tons = (record: Record<string, number>) => sumBy(Object.values(record), x => x);
  const stops = [
    { kind: 'cx' as const, id: 'AI1' },
    { kind: 'base' as const, id: 'A' },
    { kind: 'base' as const, id: 'B' },
  ];
  const segment = {
    originIndex: 0,
    departure: { RAT: 60, DW: 40 },
    bills: new Map<string, Record<string, number>>([
      ['A', { RAT: 60 }],
      ['B', { DW: 40 }],
    ]),
    loaded: new Map([['A', { H2O: 30 }]]),
  };

  it('unloads each bill and adds each pick-up, leg by leg, home included', () => {
    expect(legPayloads(stops, [segment], true, tons)).toEqual([100, 70, 30]);
  });

  it('drops the return leg on a one-way route', () => {
    expect(legPayloads(stops, [segment], false, tons)).toEqual([100, 70]);
  });

  it('starts a later origin visit with its own load', () => {
    const repeat = [
      ...stops,
      { kind: 'cx' as const, id: 'AI1' },
      { kind: 'base' as const, id: 'C' },
    ];
    const second = {
      originIndex: 3,
      departure: { FEO: 25 },
      bills: new Map([['C', { FEO: 25 }]]),
      loaded: new Map(),
    };
    expect(legPayloads(repeat, [segment, second], true, tons)).toEqual([100, 70, 30, 25, 0]);
  });
});
