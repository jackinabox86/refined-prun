import {
  addMaterials,
  subtractMaterials,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import { LEG_ESTIMATE_FACTOR, stepSeconds, type RouteEta } from '@src/features/XIT/ROUTE/route-eta';

// When each running route next draws its departure load from its origin, and
// how long the origin's stock lasts against those draws. Plain numbers in,
// plain numbers out. The buffers only supply the inputs.
//
// A lap starts at the origin: the ship unloads, refuels, and loads the departure
// bill. On a loop, routeEta's end is when the ship leaves its last stop, so the
// next lap starts one return leg later, or at the arrival when it is already
// flying to the origin. Every later lap is one whole lap after that, with unflown legs cut to 85% as
// in route-eta, so a lap is expected early rather than late.

// Stops a looping route with a near-zero lap from filling memory.
const MAX_LAPS = 1000;
const MIN_LAP_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OriginDraw {
  time: number;
  need: Record<string, number>;
}

// Whole-lap length in ms. Undefined when any leg has no known time.
export function lapMs(
  waypoints: readonly PrunApi.ShipRouteWaypoint[],
  legSeconds: readonly (number | undefined)[],
) {
  let ms = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const leg = legSeconds[i];
    if (leg === undefined) {
      return undefined;
    }
    ms += leg * LEG_ESTIMATE_FACTOR * 1000;
    for (const step of waypoints[i]?.steps ?? []) {
      ms += (stepSeconds(step) ?? 0) * 1000;
    }
  }
  return ms;
}

// The ship is at the origin and has not passed its last load step, so this
// lap's departure load is still to come out of the origin store.
export function loadingAtOrigin(execution: PrunApi.ShipRouteExecution, atWaypoint: boolean) {
  if (execution.waypointIndex !== 0 || execution.state === 'FLYING') {
    return false;
  }
  const working =
    execution.state === 'RUNNING_STEPS' ||
    execution.state === 'WAITING' ||
    execution.state === 'STEP_BLOCKED';
  if (!working && !atWaypoint) {
    return false;
  }
  const steps = execution.route.waypoints[0]?.steps ?? [];
  let lastLoad = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i]!.type === 'LOAD') {
      lastLoad = i;
    }
  }
  return lastLoad >= 0 && execution.stepIndex <= lastLoad;
}

// When a looping route next arrives at its origin. Undefined for a one-way route.
export function nextLapStart(
  execution: PrunApi.ShipRouteExecution,
  eta: RouteEta,
  legSeconds: readonly (number | undefined)[],
) {
  if (!execution.route.repeats) {
    return { time: undefined, partial: false };
  }
  if (execution.waypointIndex === 0 && eta.nextArrival !== undefined) {
    return { time: eta.nextArrival, partial: eta.partial };
  }
  const leg = legSeconds[0];
  return {
    time: eta.end + (leg ?? 0) * LEG_ESTIMATE_FACTOR * 1000,
    partial: eta.partial || leg === undefined,
  };
}

export interface LapStartInput {
  now: number;
  until: number;
  loadingNow: boolean;
  repeats: boolean;
  // From nextLapStart. Ignored when the route does not loop.
  nextLap: number | undefined;
  lapMs: number | undefined;
}

// Lap starts from now up to `until`. Without a known lap length only the next
// lap is counted. A one-way route has none: it buys for itself when sent out.
export function lapStarts(input: LapStartInput) {
  const times: number[] = [];
  if (!input.repeats) {
    return times;
  }
  if (input.loadingNow) {
    times.push(input.now);
  }
  if (input.nextLap === undefined) {
    return times;
  }
  let time = Math.max(input.now, input.nextLap);
  const step = input.lapMs === undefined ? undefined : Math.max(MIN_LAP_MS, input.lapMs);
  while (time <= input.until && times.length < MAX_LAPS) {
    times.push(time);
    if (step === undefined) {
      break;
    }
    time += step;
  }
  return times;
}

// The lap length of a saved route no ship is running: the legs at the same 85%
// factor lapStarts uses, never shorter than MIN_LAP_MS. Undefined when a leg has
// no known time.
export function plannedLapMs(legSeconds: readonly (number | undefined)[]) {
  if (legSeconds.length === 0) {
    return undefined;
  }
  let ms = 0;
  for (const leg of legSeconds) {
    if (leg === undefined) {
      return undefined;
    }
    ms += leg * LEG_ESTIMATE_FACTOR * 1000;
  }
  return Math.max(MIN_LAP_MS, ms);
}

// Departure times for a saved looping route no ship is running. The first
// departure is now, and later ones step by plannedLapMs. An unknown leg is one
// departure at now.
export function plannedDepartureTimes(
  now: number,
  until: number,
  legSeconds: readonly (number | undefined)[],
) {
  const step = plannedLapMs(legSeconds);
  if (step === undefined) {
    return [now];
  }
  const times: number[] = [];
  let time = now;
  while (time <= until && times.length < MAX_LAPS) {
    times.push(time);
    time += step;
  }
  return times;
}

// A saved CX route no ship is running. A loop departs now and every lap after
// that, and those draws are the countdown, the restock, and the reserve. The
// first departure takes the full working set. Each later one takes `topUp` of
// the gap since the one before, since the bases send their unused rest home.
// A one-way route is never bought for here: its own buy runs when it is sent
// out. A base origin is left untouched.
export function unassignedCxLoads(input: {
  now: number;
  until: number;
  looping: boolean;
  cx: boolean;
  need: Record<string, number> | undefined;
  topUp?: (gapMs: number) => Record<string, number>;
  legSeconds: readonly (number | undefined)[];
}) {
  const draws: OriginDraw[] = [];
  if (!input.cx || !input.looping) {
    return { draws, partial: false };
  }
  if (input.need === undefined) {
    return { draws, partial: true };
  }
  const times = plannedDepartureTimes(input.now, input.until, input.legSeconds);
  for (let i = 0; i < times.length; i++) {
    const time = times[i]!;
    const need =
      i === 0 || input.topUp === undefined ? input.need : input.topUp(time - times[i - 1]!);
    draws.push({ time, need });
  }
  return { draws, partial: false };
}

function sortedDraws(draws: readonly OriginDraw[]) {
  return [...draws].sort((a, b) => a.time - b.time);
}

// The first draw the stock cannot cover, all earlier draws taken first.
// Undefined when the stock covers every draw.
export function firstShortDraw(draws: readonly OriginDraw[], stock: Record<string, number>) {
  const left = { ...stock };
  for (const draw of sortedDraws(draws)) {
    let short = false;
    for (const [ticker, amount] of Object.entries(draw.need)) {
      if (!(amount > 0)) {
        continue;
      }
      const remaining = (left[ticker] ?? 0) - amount;
      left[ticker] = remaining;
      if (remaining < 0) {
        short = true;
      }
    }
    if (short) {
      return draw;
    }
  }
  return undefined;
}

// Days until the first draw the stock cannot cover. 0 when it is already short.
export function countdownDays(now: number, draw: OriginDraw | undefined) {
  if (draw === undefined) {
    return undefined;
  }
  return Math.max(0, (draw.time - now) / DAY_MS);
}

// Everything the draws before `until` take, not net of stock. The CX Buy
// action subtracts what the CX warehouse already holds.
export function drawTotal(draws: readonly OriginDraw[], until: number) {
  const total: Record<string, number> = {};
  for (const draw of draws) {
    if (draw.time > until) {
      continue;
    }
    for (const [ticker, amount] of Object.entries(draw.need)) {
      if (amount > 0) {
        total[ticker] = (total[ticker] ?? 0) + amount;
      }
    }
  }
  for (const ticker of Object.keys(total)) {
    total[ticker] = Math.ceil(total[ticker]!);
  }
  return total;
}

// What one route's restock covers: base use over the restock days, or over one
// lap when the lap is longer, and fuel for every lap in that span. A lap that
// does not depart within the restock days waits in the CX warehouse, and the
// next restock subtracts it. Departure times are estimates, so they never
// change the span. An unknown lap is fuelled once.
export function restockSpan(restockDays: number, lapDays: number | undefined) {
  if (lapDays === undefined || !(lapDays > 0)) {
    return { days: restockDays, laps: 1 };
  }
  const days = Math.max(restockDays, lapDays);
  return { days, laps: Math.max(1, Math.ceil(days / lapDays - 1e-9)) };
}

// The bases' use alone over `days`: two top-ups a day apart carry the same fuel
// and +1, so their difference is the use.
export function useOver(topUp: (gapMs: number) => Record<string, number>, days: number) {
  return subtractMaterials(topUp(daysToMs(1 + days)), topUp(daysToMs(1)));
}

// One route's restock: the bases' use over restockSpan's days plus fuel for its
// laps, with one lap's +1 and fuel. A route without a working set out yet (a
// saved loop no ship runs, or a ship loading now) also buys that working set.
export function routeRestock(
  topUp: (gapMs: number) => Record<string, number>,
  need: Record<string, number>,
  workingSet: boolean,
  restockDays: number,
  lapMsValue: number | undefined,
) {
  const span = restockSpan(
    restockDays,
    lapMsValue === undefined ? undefined : lapMsValue / daysToMs(1),
  );
  let total = workingSet
    ? addMaterials(need, useOver(topUp, span.days))
    : topUp(daysToMs(span.days));
  // A lap's fixed part is its fuel and the +1 spares; only the fuel repeats.
  const fixed = subtractMaterials(topUp(daysToMs(1)), useOver(topUp, 1));
  const lapFuel: Record<string, number> = {};
  for (const ticker of ['SF', 'FF']) {
    if (fixed[ticker] !== undefined) {
      lapFuel[ticker] = fixed[ticker];
    }
  }
  for (let i = 1; i < span.laps; i++) {
    total = addMaterials(total, lapFuel);
  }
  return total;
}

export function daysToMs(days: number) {
  return days * DAY_MS;
}
