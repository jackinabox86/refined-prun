import { describe, expect, it } from 'vitest';
import {
  heldStock,
  reservedDraws,
  restockWindowEnd,
  routeStockDraws,
  withoutReserve,
} from '@src/features/XIT/ROUTE/route-reserve';

const DAY = 24 * 60 * 60 * 1000;

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

describe('restockWindowEnd', () => {
  it('runs the resupply days from the last restock, not from now', () => {
    expect(restockWindowEnd(1000, 7, 1000 + 5 * DAY)).toBe(1000 + 7 * DAY);
  });

  it('holds nothing for an exchange never restocked or past its window', () => {
    expect(restockWindowEnd(undefined, 7, 0)).toBeUndefined();
    expect(restockWindowEnd(0, 7, 7 * DAY)).toBeUndefined();
  });
});

describe('routeStockDraws', () => {
  it('flags only takes that leave less than the routes hold', () => {
    expect(
      routeStockDraws({ RAT: 100, DW: 100 }, { RAT: 50, DW: 50 }, { RAT: 60, DW: 40 }),
    ).toEqual([{ ticker: 'RAT', held: 60, left: 50 }]);
  });

  it('ignores tickers the routes do not load', () => {
    expect(routeStockDraws({ OVE: 5 }, { OVE: 5 }, { RAT: 60 })).toEqual([]);
  });
});

describe('reservedDraws', () => {
  const draws = [
    { time: 2 * DAY, route: 'a' },
    { time: 6 * DAY, route: 'a' },
    { time: 6 * DAY, route: 'b' },
  ];

  it('holds a route past the window only up to its waiting-lap hold', () => {
    expect(reservedDraws(draws, 5 * DAY, { a: 7 * DAY })).toEqual([draws[0], draws[1]]);
  });

  it('keeps holding the waiting lap after the window has run out', () => {
    expect(reservedDraws(draws, undefined, { b: 7 * DAY })).toEqual([draws[2]]);
  });
});
