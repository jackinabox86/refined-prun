export type SortKey = 'name' | 'burn' | 'repair' | 'proximity';
export type SortDirection = 'asc' | 'desc';

export interface SortableBase {
  naturalId: string;
  days: number | undefined;
  repairDays: number | undefined;
  repairTarget: number;
}

// Both factors floor at zero. Past a deadline there is nothing left to count
// down, so a base that is already due does not keep ranking further ahead of
// the rest the longer it waits.

// Days until the base runs dry. Burn ranks toward zero supply, not toward the
// red warning line that precedes it.
export function daysUntilBurnOut(days: number | undefined) {
  if (days === undefined) {
    return undefined;
  }
  return Math.max(0, days);
}

// Days until the oldest building reaches the repair target.
export function daysUntilRepairTarget(age: number | undefined, target: number) {
  if (age === undefined) {
    return undefined;
  }
  return Math.max(0, target - age);
}

// Most urgent of the two: fewer days until a deadline ranks first.
// A missing factor is omitted so one known value still ranks the base.
export function combinedDaysUntilDue(
  days: number | undefined,
  age: number | undefined,
  repairTarget: number,
) {
  const burn = daysUntilBurnOut(days);
  const repair = daysUntilRepairTarget(age, repairTarget);
  if (burn === undefined) {
    return repair ?? Infinity;
  }
  if (repair === undefined) {
    return burn;
  }
  return Math.min(burn, repair);
}

// How far past a deadline a base already is, taking whichever factor is further
// past. Only breaks a tie between bases that both scored zero above: the more
// overdue ranks first.
export function daysPastDue(
  days: number | undefined,
  age: number | undefined,
  repairTarget: number,
) {
  const burn = days === undefined ? 0 : Math.max(0, -days);
  const repair = age === undefined ? 0 : Math.max(0, age - repairTarget);
  return Math.max(burn, repair);
}

// Burn wins a tie on days past due: a base out of supply outranks one that has
// only just reached its repair target.
export function isBurnAtDeadline(days: number | undefined) {
  return days !== undefined && days <= 0;
}

export function compareBases(
  a: SortableBase,
  b: SortableBase,
  key: SortKey,
  direction: SortDirection,
  compareNames: (left: string, right: string) => number,
) {
  const dir = direction === 'asc' ? 1 : -1;
  if (key === 'burn') {
    const daysA = a.days ?? Infinity;
    const daysB = b.days ?? Infinity;
    if (daysA !== daysB) {
      return (daysA - daysB) * dir;
    }
  }
  if (key === 'repair') {
    const repA = a.repairDays ?? -Infinity;
    const repB = b.repairDays ?? -Infinity;
    if (repA !== repB) {
      return (repB - repA) * dir;
    }
  }
  if (key === 'proximity') {
    const proxA = combinedDaysUntilDue(a.days, a.repairDays, a.repairTarget);
    const proxB = combinedDaysUntilDue(b.days, b.repairDays, b.repairTarget);
    if (proxA !== proxB) {
      return (proxA - proxB) * dir;
    }
    const dueA = daysPastDue(a.days, a.repairDays, a.repairTarget);
    const dueB = daysPastDue(b.days, b.repairDays, b.repairTarget);
    if (dueA !== dueB) {
      return (dueB - dueA) * dir;
    }
    const burnA = isBurnAtDeadline(a.days);
    const burnB = isBurnAtDeadline(b.days);
    if (burnA !== burnB) {
      return (burnA ? -1 : 1) * dir;
    }
  }
  return compareNames(a.naturalId, b.naturalId) * dir;
}
