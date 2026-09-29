import { describe, expect, it } from 'vitest';
import {
  combinedDaysUntilDue,
  compareBases,
  daysPastDue,
  daysUntilBurnOut,
  daysUntilRepairTarget,
  isBurnAtDeadline,
  type SortKey,
  type SortableBase,
} from './base-sort';

function base(partial: Partial<SortableBase> & Pick<SortableBase, 'naturalId'>): SortableBase {
  return {
    days: 10,
    repairDays: 20,
    repairTarget: 60,
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

// Comfortable burn, repair one day from the target.
const repairUrgent = base({ naturalId: 'AA-001a', days: 20, repairDays: 59 });
// Low burn days, buildings far from the repair target.
const burnUrgent = base({ naturalId: 'ZZ-999z', days: 5, repairDays: 10 });

describe('daysUntilBurnOut', () => {
  it('is days of supply remaining, not the distance to a warning line', () => {
    expect(daysUntilBurnOut(8)).toBe(8);
  });

  it('floors at zero', () => {
    expect(daysUntilBurnOut(-4)).toBe(0);
  });

  it('is undefined when burn days are unknown', () => {
    expect(daysUntilBurnOut(undefined)).toBeUndefined();
  });
});

describe('daysUntilRepairTarget', () => {
  it('is the repair target minus building age', () => {
    expect(daysUntilRepairTarget(50, 60)).toBe(10);
  });

  it('floors at zero once the target is passed', () => {
    expect(daysUntilRepairTarget(75, 60)).toBe(0);
    expect(daysUntilRepairTarget(200, 60)).toBe(0);
  });

  it('is undefined when repair age is unknown', () => {
    expect(daysUntilRepairTarget(undefined, 60)).toBeUndefined();
  });
});

describe('combinedDaysUntilDue', () => {
  it('takes the more urgent of the two factors', () => {
    expect(combinedDaysUntilDue(20, 59, 60)).toBe(1);
    expect(combinedDaysUntilDue(5, 10, 60)).toBe(5);
  });

  it('measures burn against running dry, not against the burn red line', () => {
    // A red line of 3 would have scored this 2; the deadline is zero supply.
    expect(combinedDaysUntilDue(5, undefined, 60)).toBe(5);
  });

  it('omits a missing factor', () => {
    expect(combinedDaysUntilDue(undefined, 59, 60)).toBe(1);
    expect(combinedDaysUntilDue(5, undefined, 60)).toBe(5);
  });

  it('is Infinity when both factors are missing', () => {
    expect(combinedDaysUntilDue(undefined, undefined, 60)).toBe(Infinity);
  });

  it('does not run past a passed deadline', () => {
    expect(combinedDaysUntilDue(0, 20, 60)).toBe(0);
    expect(combinedDaysUntilDue(90, 300, 60)).toBe(0);
  });

  it('ties every overdue base at zero instead of ranking by how overdue it is', () => {
    expect(combinedDaysUntilDue(90, 61, 60)).toBe(combinedDaysUntilDue(90, 400, 60));
  });
});

describe('daysPastDue', () => {
  it('is zero while both deadlines are still ahead', () => {
    expect(daysPastDue(5, 20, 60)).toBe(0);
  });

  it('is days past the repair target', () => {
    expect(daysPastDue(5, 90, 60)).toBe(30);
  });

  it('takes whichever factor is further past', () => {
    expect(daysPastDue(-2, 70, 60)).toBe(10);
    expect(daysPastDue(-40, 70, 60)).toBe(40);
  });

  it('ignores a missing factor', () => {
    expect(daysPastDue(undefined, 90, 60)).toBe(30);
    expect(daysPastDue(5, undefined, 60)).toBe(0);
  });
});

describe('isBurnAtDeadline', () => {
  it('is true once supply is gone', () => {
    expect(isBurnAtDeadline(0)).toBe(true);
    expect(isBurnAtDeadline(-3)).toBe(true);
  });

  it('is false while supply remains or is unknown', () => {
    expect(isBurnAtDeadline(0.4)).toBe(false);
    expect(isBurnAtDeadline(undefined)).toBe(false);
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

  it('ranks by the closer deadline, not by one raw factor', () => {
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

  it('ranks the most overdue base first among bases tied at zero', () => {
    const overdue = [
      base({ naturalId: 'AA-001a', days: 20, repairDays: 62 }),
      base({ naturalId: 'BB-002b', days: 20, repairDays: 140 }),
      base({ naturalId: 'CC-003c', days: 20, repairDays: 95 }),
    ];
    expect(order(overdue, 'proximity')).toEqual(['BB-002b', 'CC-003c', 'AA-001a']);
  });

  it('gives burn the tie when two bases are equally far past due', () => {
    // Both score zero proximity and zero days past due: out of supply, versus
    // buildings that have only just reached the repair target.
    const outOfSupply = base({ naturalId: 'ZZ-999z', days: 0, repairDays: 10 });
    const justDue = base({ naturalId: 'AA-001a', days: 20, repairDays: 60 });
    expect(order([justDue, outOfSupply], 'proximity')).toEqual(['ZZ-999z', 'AA-001a']);
  });

  it('still lets a more overdue repair outrank an out-of-supply base', () => {
    const outOfSupply = base({ naturalId: 'AA-001a', days: 0, repairDays: 10 });
    const longOverdue = base({ naturalId: 'ZZ-999z', days: 20, repairDays: 95 });
    expect(order([outOfSupply, longOverdue], 'proximity')).toEqual(['ZZ-999z', 'AA-001a']);
  });

  it('reverses the overdue tiebreak along with the direction', () => {
    const outOfSupply = base({ naturalId: 'ZZ-999z', days: 0, repairDays: 10 });
    const justDue = base({ naturalId: 'AA-001a', days: 20, repairDays: 60 });
    expect(order([justDue, outOfSupply], 'proximity', 'desc')).toEqual(['AA-001a', 'ZZ-999z']);
  });

  // Reported order: a base one day from its repair target sank below nine bases
  // whose repair was weeks out, because those were already past the burn red
  // line and scored unboundedly negative.
  it('puts a base one day from repair above bases with days of burn left', () => {
    const reported = [
      base({ naturalId: 'WU-308b', days: 1.4, repairDays: 55 }),
      base({ naturalId: 'SE-751a', days: 1.4, repairDays: 56 }),
      base({ naturalId: 'BO-001a', days: 2, repairDays: 55 }),
      base({ naturalId: 'HA-001a', days: 2.1, repairDays: 43 }),
      base({ naturalId: 'HE-001a', days: 2.2, repairDays: 37 }),
      base({ naturalId: 'RO-001b', days: 2.3, repairDays: 4 }),
      base({ naturalId: 'LE-137c', days: 2.7, repairDays: 4 }),
      base({ naturalId: 'KI-840c', days: 3.1, repairDays: 36 }),
      base({ naturalId: 'ME-001c', days: 4, repairDays: 59 }),
      base({ naturalId: 'ME-001b', days: 4, repairDays: 52 }),
      base({ naturalId: 'ME-001d', days: 4, repairDays: 58 }),
    ];
    expect(order(reported, 'proximity')[0]).toBe('ME-001c');
  });
});
