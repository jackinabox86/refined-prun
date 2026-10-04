import { arrivingLeg } from '@src/features/XIT/ROUTE/route-calc';

// When a ship on a game route (RT) finishes it, or, on a looping route, starts the
// next lap. Plain numbers in, plain numbers out. The buffer only supplies the inputs.
//
// The game gives exact times only for the flight in progress (its arrival) and a
// running wait step (stepEndsAt). A leg that has not started is estimated from the
// ROUTECONFIG test flight. ROUTECONFIG stores those raw seconds and pads them only
// on read (padLegSeconds: 25% or two hours, whichever adds more), so no padding has
// to be taken back out here. The raw time is then cut by 15%, because a route that
// is expected later than it really ends is the worse mistake.

export const LEG_ESTIMATE_FACTOR = 0.85;

const UNIT_SECONDS: Record<string, number> = {
  SECONDS: 1,
  MINUTES: 60,
  HOURS: 60 * 60,
  DAYS: 24 * 60 * 60,
};

export interface RouteEtaInput {
  execution: PrunApi.ShipRouteExecution;
  now: number;
  // Arrival of the flight in execution.flightId, when the flight store has it.
  flightArrival: number | undefined;
  // The ship sits at the current waypoint, so its leg is already flown.
  atWaypoint: boolean;
  // Raw test-flight seconds of the leg that flies to each waypoint.
  legSeconds: readonly (number | undefined)[];
}

export interface RouteEta {
  // Arrival at the current waypoint. Undefined once the ship is there.
  nextArrival: number | undefined;
  // One-way: the last step of the last waypoint. Loop: the moment the next lap starts.
  end: number;
  // A leg or wait had no known duration, so end is earlier than it can really be.
  partial: boolean;
  // At least one leg was estimated rather than read from a live flight.
  estimated: boolean;
}

export function stepSeconds(step: PrunApi.ShipRouteStep) {
  if (step.type !== 'WAIT') {
    return 0;
  }
  const unit = step.unit === undefined ? undefined : UNIT_SECONDS[step.unit];
  if (unit === undefined || step.amount === undefined) {
    return undefined;
  }
  return step.amount * unit;
}

export function routeEta(input: RouteEtaInput): RouteEta {
  const { execution, now } = input;
  const waypoints = execution.route.waypoints;
  let time = now;
  let partial = false;
  let estimated = false;

  function flyLeg(index: number) {
    const seconds = input.legSeconds[index];
    if (seconds === undefined) {
      partial = true;
      return;
    }
    estimated = true;
    time += seconds * LEG_ESTIMATE_FACTOR * 1000;
  }

  function runSteps(index: number, from: number) {
    const steps = waypoints[index]?.steps ?? [];
    for (let i = from; i < steps.length; i++) {
      const seconds = stepSeconds(steps[i]!);
      if (seconds === undefined) {
        partial = true;
        continue;
      }
      time += seconds * 1000;
    }
  }

  const current = execution.waypointIndex;
  let nextArrival: number | undefined;
  let firstStep = 0;
  const flying = execution.state === 'FLYING';
  const working =
    execution.state === 'RUNNING_STEPS' ||
    execution.state === 'WAITING' ||
    execution.state === 'STEP_BLOCKED';
  if (flying && input.flightArrival !== undefined) {
    time = Math.max(time, input.flightArrival);
    nextArrival = time;
  } else if (working || (!flying && input.atWaypoint)) {
    firstStep = execution.stepIndex;
  } else {
    flyLeg(current);
    nextArrival = time;
  }

  if (execution.state === 'WAITING' && execution.stepEndsAt) {
    time = Math.max(time, execution.stepEndsAt.timestamp);
    firstStep = execution.stepIndex + 1;
  }
  runSteps(current, firstStep);

  for (let i = current + 1; i < waypoints.length; i++) {
    flyLeg(i);
    runSteps(i, 0);
  }

  return { nextArrival, end: time, partial, estimated };
}

// The ROUTECONFIG route this game route was built from: the same stop sequence,
// preferring one saved with the same ship. Stops are compared by location id
// (ANT, ZV-759c), which resolveStop supplies for a saved stop.
export function matchConfigRoute(
  waypointIds: readonly (string | undefined)[],
  shipRegistration: string | undefined,
  routes: readonly UserData.ShippingRoute[],
  resolveStop: (stop: UserData.ShippingRouteStop) => string | undefined,
) {
  const matches = routes.filter(
    route =>
      route.stops.length === waypointIds.length &&
      route.stops.every((stop, i) => {
        const id = waypointIds[i];
        return id !== undefined && resolveStop(stop) === id;
      }),
  );
  return matches.find(route => route.ship === shipRegistration) ?? matches[0];
}

// Raw seconds of the leg flying to each waypoint. A one-way route never flies to
// its first stop, and a loop flies there on the return leg.
export function configLegSeconds(saved: UserData.ShippingRoute | undefined, looping: boolean) {
  if (saved === undefined) {
    return [];
  }
  return saved.stops.map((_, i) => {
    const leg = arrivingLeg(saved.legs, i, saved.stops.length, looping);
    return leg?.ok === true ? leg.seconds : undefined;
  });
}
