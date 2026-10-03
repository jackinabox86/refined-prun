// Route padding, burn countdown, fuel reserve, and day fit.
// Plain numbers in, plain numbers out. The buffers only supply the inputs.

export const ROUTE_DAY_STEP = 0.1;
export const ROUTE_DAY_MAX = 999;
export const FUEL_RESERVE_RATIO = 0.2;
export const SECONDS_PER_DAY = 86400;
const TWO_HOURS_SECONDS = 2 * 60 * 60;

export interface TankStop {
  level: number;
  refuel: boolean;
  loaded: number;
}

export interface FuelLoad {
  stl: number;
  ftl: number;
}

// Per leg: 25% or two hours, whichever adds more time.
export function padLegSeconds(seconds: number) {
  return Math.max(seconds * 1.25, seconds + TWO_HOURS_SECONDS);
}

export function paddedLegSeconds(legs: readonly { ok: boolean; seconds?: number }[]) {
  return legs.map(leg => (leg.ok && leg.seconds !== undefined ? padLegSeconds(leg.seconds) : 0));
}

// Flight time already spent when the ship arrives at this stop. Index 0 is the start.
// The first leg is not counted, matching BURN: a base's clock already covers the
// time to reach it from wherever the ship is now.
export function cumulativeSecondsBeforeStop(paddedLegs: readonly number[], stopIndex: number) {
  let sum = 0;
  const last = Math.min(stopIndex, paddedLegs.length);
  for (let i = 1; i < last; i++) {
    sum += paddedLegs[i] ?? 0;
  }
  return sum;
}

export function minAdjustedBurn(
  burnDays: readonly (number | undefined)[],
  paddedLegs: readonly number[],
) {
  let min: number | undefined;
  for (let i = 0; i < burnDays.length; i++) {
    const days = burnDays[i];
    if (days === undefined) {
      continue;
    }
    const adjusted = days - cumulativeSecondsBeforeStop(paddedLegs, i) / SECONDS_PER_DAY;
    if (min === undefined || adjusted < min) {
      min = adjusted;
    }
  }
  return min;
}

// Stored days win. Otherwise the padded flight time, snapped to the 0.1 day step.
export function routeSupplyDays(stored: number | undefined, paddedSeconds: number) {
  if (stored !== undefined && !isNaN(stored)) {
    return stored;
  }
  return snapDays(paddedSeconds / SECONDS_PER_DAY);
}

export function snapDays(days: number) {
  if (!Number.isFinite(days)) {
    return 0;
  }
  const snapped = Math.round(days / ROUTE_DAY_STEP) * ROUTE_DAY_STEP;
  return Math.min(ROUTE_DAY_MAX, Math.max(0, Number(snapped.toFixed(1))));
}

// Same monotonic search as maxFittingDays, at the route step of 0.1.
export function maxDaysAtStep(fits: (days: number) => boolean) {
  const maxUnits = Math.round(ROUTE_DAY_MAX / ROUTE_DAY_STEP);
  let lo = 0;
  let hi = maxUnits;
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2);
    if (fits(snapDays(mid * ROUTE_DAY_STEP))) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return snapDays(lo * ROUTE_DAY_STEP);
}

// Start full. If a leg would land below the reserve, top up at the stop
// before that leg, only as far as the tank can hold and only enough that the
// rest of the route can finish at the reserve. A full tank that still cannot
// hold that much is flagged and filled to capacity; the next stop tries again.
export function planTank(
  capacity: number,
  burns: readonly number[],
  reserveRatio = FUEL_RESERVE_RATIO,
): TankStop[] {
  if (capacity <= 0) {
    const empty: TankStop[] = [];
    for (let i = 0; i < burns.length + 1; i++) {
      empty.push({ level: 0, refuel: false, loaded: 0 });
    }
    return empty;
  }
  const reserve = capacity * reserveRatio;
  const stops: TankStop[] = [{ level: capacity, refuel: false, loaded: 0 }];
  let remaining = capacity;
  for (let i = 0; i < burns.length; i++) {
    const burn = burns[i] ?? 0;
    if (remaining - burn < reserve) {
      let ahead = 0;
      for (let j = i; j < burns.length; j++) {
        ahead += burns[j] ?? 0;
      }
      const target = Math.min(capacity, reserve + ahead);
      const loaded = Math.max(0, target - remaining);
      remaining += loaded;
      const current = stops[i]!;
      stops[i] = { level: current.level, refuel: true, loaded };
    }
    remaining -= burn;
    if (remaining < 0) {
      remaining = 0;
    }
    stops.push({ level: remaining, refuel: false, loaded: 0 });
  }
  return stops;
}

export function planRouteTanks(
  stlCapacity: number,
  ftlCapacity: number,
  legs: readonly { ok: boolean; stl?: number; ftl?: number }[],
) {
  return {
    stl: planTank(
      stlCapacity,
      legs.map(leg => (leg.ok ? (leg.stl ?? 0) : 0)),
    ),
    ftl: planTank(
      ftlCapacity,
      legs.map(leg => (leg.ok ? (leg.ftl ?? 0) : 0)),
    ),
  };
}

// Fuel bought onto the ship as cargo. The origin stop fills the tank in place,
// so its load is not cargo.
export function fuelCargoLoads(stl: readonly TankStop[], ftl: readonly TankStop[]) {
  const count = Math.max(stl.length, ftl.length);
  const loads: FuelLoad[] = [];
  for (let i = 0; i < count; i++) {
    loads.push({
      stl: i === 0 ? 0 : (stl[i]?.loaded ?? 0),
      ftl: i === 0 ? 0 : (ftl[i]?.loaded ?? 0),
    });
  }
  return loads;
}

// TRANSITS stop list. A loop adds the origin once more so the return leg
// is part of the flight time. The saved route stops stay as the player ordered them.
export function transitStopIds(stops: readonly { id: string }[], loop: boolean | undefined) {
  const ids = stops.map(stop => stop.id);
  if (loop === false || ids.length === 0) {
    return ids;
  }
  const origin = ids[0];
  if (origin !== undefined) {
    ids.push(origin);
  }
  return ids;
}

export function formatFuelCell(stl: TankStop | undefined, ftl: TankStop | undefined) {
  if (stl === undefined && ftl === undefined) {
    return '--';
  }
  if (stl?.refuel === true || ftl?.refuel === true) {
    return 'refuel';
  }
  return `${Math.round(stl?.level ?? 0)} STL / ${Math.round(ftl?.level ?? 0)} FTL`;
}
