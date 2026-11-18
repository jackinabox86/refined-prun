import { describe, expect, it } from 'vitest';
import {
  cogcBuyAmounts,
  materialDays,
  planetGovBurnBill,
  suggestedCogcDays,
} from '@src/features/XIT/GOVBURN/utils';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function upkeep(stored: number, lastTickIn = 6.6) {
  return {
    ticker: 'IDC',
    stored,
    amount: 3,
    duration: 15,
    nextTick: NOW + lastTickIn * MS_IN_DAY,
  };
}

describe('materialDays', () => {
  it('does not count an unpaid 15-day period as remaining days', () => {
    expect(materialDays(upkeep(0), NOW)).toBe(0);
  });

  it('does not count a partial contribution toward the next tick', () => {
    // 2 of 3 IDC stored: the next tick at nextTick cannot be paid.
    expect(materialDays(upkeep(2), NOW)).toBe(0);
  });

  it('still adds full ticks already in reserve', () => {
    expect(materialDays(upkeep(3), NOW)).toBeCloseTo(6.6 + 15);
  });

  // Live capture, INF @ LS-300e (Antares V e), game POPID buffer:
  // TUB: stored 0 / 100, every 15 days, next in 6 days 5h, Last for "--".
  // STR: stored 0 / 10, every 15 days, next in 6 days 5h, Last for "--".
  // OFF: stored 200 / 50, every 5 days, next in 1 day 5h, Last for 20 days.
  const LS_300E_NEXT_TICK = NOW + (6 * 24 + 5) * 3_600_000;
  it('matches the game for INF @ LS-300e 15-day TUB and STR (reserve "--")', () => {
    const tub = {
      ticker: 'TUB',
      stored: 0,
      amount: 100,
      duration: 15,
      nextTick: LS_300E_NEXT_TICK,
    };
    const str = { ticker: 'STR', stored: 0, amount: 10, duration: 15, nextTick: LS_300E_NEXT_TICK };
    expect(materialDays(tub, NOW)).toBe(0);
    expect(materialDays(str, NOW)).toBe(0);
  });

  it('matches the game for INF @ LS-300e 5-day OFF (200 stored = 4 ticks)', () => {
    // Game "Last for" shows the 20 reserve days; the first unpayable tick is 1d 5h
    // later, so the total is 21.2 days.
    const off = {
      ticker: 'OFF',
      stored: 200,
      amount: 50,
      duration: 5,
      nextTick: NOW + (1 * 24 + 5) * 3_600_000,
    };
    expect(materialDays(off, NOW)).toBeCloseTo(21.21, 1);
  });
});

describe('suggestedCogcDays', () => {
  it('matches the old refill bands', () => {
    expect(suggestedCogcDays(5)).toBe(10);
    expect(suggestedCogcDays(10)).toBe(10);
    expect(suggestedCogcDays(15)).toBe(20);
    expect(suggestedCogcDays(20)).toBe(20);
    expect(suggestedCogcDays(25)).toBe(30);
    expect(suggestedCogcDays(30)).toBe(30);
  });
});

describe('cogcBuyAmounts', () => {
  const cogc = {
    dueDate: NOW,
    materials: [{ ticker: 'DW', amount: 10, currentAmount: 4 }],
  };

  it('buys nothing for 0 days and full refills for 10, 20, and 30', () => {
    expect(cogcBuyAmounts(cogc, 0)).toEqual({});
    expect(cogcBuyAmounts(cogc, 10)).toEqual({ DW: 10 });
    expect(cogcBuyAmounts(cogc, 20)).toEqual({ DW: 20 });
    expect(cogcBuyAmounts(cogc, 30)).toEqual({ DW: 30 });
  });

  it('does not follow the POPI horizon once days are chosen', () => {
    const planet = {
      naturalId: 'OT-580b',
      name: 'Aceland',
      capturedAt: NOW,
      buildings: [],
      cogc,
    };
    expect(planetGovBurnBill(planet, {}, 30, NOW, 0)).toEqual({});
    expect(planetGovBurnBill(planet, {}, 5, NOW, 30)).toEqual({ DW: 30 });
  });
});
