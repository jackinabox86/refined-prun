export type SortKey = 'name' | 'burn' | 'repair' | 'proximity';
export type SortDirection = 'asc' | 'desc';

export interface SortableBase {
  naturalId: string;
  days: number | undefined;
  repairDays: number | undefined;
  burnThreshold: number;
  repairThreshold: number;
}

export function daysUntilBurnThreshold(days: number | undefined, threshold: number) {
  if (days === undefined) {
    return undefined;
  }
  return days - threshold;
}

export function daysUntilRepairThreshold(age: number | undefined, threshold: number) {
  if (age === undefined) {
    return undefined;
  }
  return threshold - age;
}

// Most urgent of the two: fewer days until a red threshold ranks first.
// A missing factor is omitted so one known value still ranks the base.
export function combinedDaysUntilThreshold(
  days: number | undefined,
  burnThreshold: number,
  age: number | undefined,
  repairThreshold: number,
) {
  const burn = daysUntilBurnThreshold(days, burnThreshold);
  const repair = daysUntilRepairThreshold(age, repairThreshold);
  if (burn === undefined) {
    return repair ?? Infinity;
  }
  if (repair === undefined) {
    return burn;
  }
  return Math.min(burn, repair);
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
    const proxA = combinedDaysUntilThreshold(
      a.days,
      a.burnThreshold,
      a.repairDays,
      a.repairThreshold,
    );
    const proxB = combinedDaysUntilThreshold(
      b.days,
      b.burnThreshold,
      b.repairDays,
      b.repairThreshold,
    );
    if (proxA !== proxB) {
      return (proxA - proxB) * dir;
    }
  }
  return compareNames(a.naturalId, b.naturalId) * dir;
}
