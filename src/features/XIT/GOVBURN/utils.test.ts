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
    expect(materialDays(upkeep(1), NOW, NOW - 40 * MS_IN_DAY)).toBe(0);
  });

  it('counts the open period when a contribution falls inside it', () => {
    const row = upkeep(0);
    const duringPeriod = row.nextTick - MS_IN_DAY;
    expect(materialDays(row, NOW, duringPeriod)).toBeCloseTo(6.6);
  });

  it('still adds full ticks already in reserve', () => {
    expect(materialDays(upkeep(3), NOW)).toBeCloseTo(6.6 + 15);
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
