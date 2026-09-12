import { describe, expect, it } from 'vitest';
import {
  combinedDaysUntilThreshold,
  compareBases,
  daysUntilBurnThreshold,
  daysUntilRepairThreshold,
  type SortKey,
  type SortableBase,
} from './base-sort';

function base(partial: Partial<SortableBase> & Pick<SortableBase, 'naturalId'>): SortableBase {
  return {
    days: 10,
    repairDays: 20,
    burnThreshold: 3,
    repairThreshold: 60,
    ...partial,
  };
}

function compareNames(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function order(entries: SortableBase[], key: SortKey, direction: 'asc' | 'desc' = 'asc') {
  return [...entries]
    .sort((a, b) => compareBases(a, b, key, direction, compareNames))
    .map(x => x.naturalId);
}

// Comfortable burn, repair one day from the red threshold.
const repairUrgent = base({ naturalId: 'AA-001a', days: 20, repairDays: 59 });
// Low burn days, buildings far from the repair threshold.
const burnUrgent = base({ naturalId: 'ZZ-999z', days: 5, repairDays: 10 });

describe('daysUntilBurnThreshold', () => {
  it('is days remaining minus the red burn line', () => {
    expect(daysUntilBurnThreshold(8, 3)).toBe(5);
  });

  it('is undefined when burn days are unknown', () => {
    expect(daysUntilBurnThreshold(undefined, 3)).toBeUndefined();
  });
});

describe('daysUntilRepairThreshold', () => {
  it('is the red repair line minus building age', () => {
    expect(daysUntilRepairThreshold(50, 60)).toBe(10);
  });

  it('is undefined when repair age is unknown', () => {
    expect(daysUntilRepairThreshold(undefined, 60)).toBeUndefined();
  });
});

describe('combinedDaysUntilThreshold', () => {
  it('takes the more urgent of the two factors', () => {
    expect(combinedDaysUntilThreshold(20, 3, 59, 60)).toBe(1);
    expect(combinedDaysUntilThreshold(5, 3, 10, 60)).toBe(2);
  });

  it('omits a missing factor', () => {
    expect(combinedDaysUntilThreshold(undefined, 3, 59, 60)).toBe(1);
    expect(combinedDaysUntilThreshold(5, 3, undefined, 60)).toBe(2);
  });

  it('is Infinity when both factors are missing', () => {
    expect(combinedDaysUntilThreshold(undefined, 3, undefined, 60)).toBe(Infinity);
  });
});

describe('compareBases', () => {
  const pair = [repairUrgent, burnUrgent];

  it('keeps the raw burn sort', () => {
    expect(order(pair, 'burn')).toEqual(['ZZ-999z', 'AA-001a']);
  });

  it('keeps the raw repair sort', () => {
    expect(order(pair, 'repair')).toEqual(['AA-001a', 'ZZ-999z']);
  });

  it('keeps the name sort', () => {
    expect(order(pair, 'name')).toEqual(['AA-001a', 'ZZ-999z']);
  });

  it('ranks by the closer threshold, not by one raw factor', () => {
    expect(order(pair, 'proximity')).toEqual(['AA-001a', 'ZZ-999z']);
  });

  it('does not rank proximity by raw burn days', () => {
    const proximity = order(pair, 'proximity');
    const burn = order(pair, 'burn');
    expect(proximity).not.toEqual(burn);
  });

  it('reverses proximity when asked', () => {
    expect(order(pair, 'proximity', 'desc')).toEqual(['ZZ-999z', 'AA-001a']);
  });

  it('falls through to the name comparator on a proximity tie', () => {
    const tied = [
      base({ naturalId: 'ZZ-999z', days: 10, repairDays: 10 }),
      base({ naturalId: 'AA-001a', days: 10, repairDays: 10 }),
    ];
    expect(order(tied, 'proximity')).toEqual(['AA-001a', 'ZZ-999z']);
  });

  it('sorts a base with no known factors last on ascending proximity', () => {
    const unknown = base({
      naturalId: 'MM-500c',
      days: undefined,
      repairDays: undefined,
    });
    expect(order([unknown, burnUrgent], 'proximity')).toEqual(['ZZ-999z', 'MM-500c']);
  });
});
