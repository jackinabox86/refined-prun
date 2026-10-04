import { describe, expect, it } from 'vitest';
import {
  cumulativeSecondsBeforeStop,
  formatFuelCell,
  fuelCargoLoads,
  maxDaysAtStep,
  minAdjustedBurn,
  padLegSeconds,
  planRouteTanks,
  planTank,
  routeSupplyDays,
  snapDays,
  transitStopIds,
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
