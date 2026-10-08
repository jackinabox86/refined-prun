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
// lap is counted.
export function lapStarts(input: LapStartInput) {
  const times: number[] = [];
  if (input.loadingNow) {
    times.push(input.now);
  }
  if (!input.repeats || input.nextLap === undefined) {
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

// Departure times for a saved looping route no ship is running. The first
// departure is now. Later ones step by the legs at the same 85% factor lapStarts
// uses, and never shorter than MIN_LAP_MS. An unknown leg is one departure at now.
export function plannedDepartureTimes(
  now: number,
  until: number,
  legSeconds: readonly (number | undefined)[],
) {
  if (legSeconds.length === 0) {
    return [now];
  }
  let ms = 0;
  for (const leg of legSeconds) {
    if (leg === undefined) {
      return [now];
    }
    ms += leg * LEG_ESTIMATE_FACTOR * 1000;
  }
  const step = Math.max(MIN_LAP_MS, ms);
  const times: number[] = [];
  let time = now;
  while (time <= until && times.length < MAX_LAPS) {
    times.push(time);
    time += step;
  }
  return times;
}

// A saved CX route no ship is running. A loop departs now and every lap after
// that, and those draws are the countdown, the restock, and the reserve. A
// one-way route is never bought for here: its own buy runs when it is sent
// out. A base origin is left untouched.
export function unassignedCxLoads(input: {
  now: number;
  until: number;
  looping: boolean;
  cx: boolean;
  need: Record<string, number> | undefined;
  legSeconds: readonly (number | undefined)[];
}) {
  const draws: OriginDraw[] = [];
  if (!input.cx || !input.looping) {
    return { draws, partial: false };
  }
  if (input.need === undefined) {
    return { draws, partial: true };
  }
  for (const time of plannedDepartureTimes(input.now, input.until, input.legSeconds)) {
    draws.push({ time, need: input.need });
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

export function daysToMs(days: number) {
  return days * DAY_MS;
}
