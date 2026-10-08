import { describe, expect, it } from 'vitest';
import { LEG_ESTIMATE_FACTOR, type RouteEta } from '@src/features/XIT/ROUTE/route-eta';
import {
  countdownDays,
  drawTotal,
  firstShortDraw,
  lapMs,
  lapStarts,
  loadingAtOrigin,
  nextLapStart,
  plannedDepartureTimes,
  unassignedCxLoads,
  type OriginDraw,
} from '@src/features/XIT/ROUTE/route-supply';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = 1_000_000_000;

function step(type: string, amount?: number, unit?: string): PrunApi.ShipRouteStep {
  return { id: `${type}${amount ?? ''}`, type, amount, unit };
}

function waypoint(steps: PrunApi.ShipRouteStep[] = []) {
  return { steps } as PrunApi.ShipRouteWaypoint;
}

const origin = waypoint([step('UNLOAD'), step('REFUEL'), step('LOAD'), step('LOAD')]);

function execution(
  state: PrunApi.ShipRouteExecutionState,
  waypointIndex: number,
  stepIndex = 0,
  repeats = true,
): PrunApi.ShipRouteExecution {
  return {
    shipId: 'ship',
    route: { repeats, waypoints: [origin, waypoint([step('UNLOAD')])] } as PrunApi.ShipRoute,
    state,
    waypointIndex,
    stepIndex,
    flightId: null,
    stepStartedAt: null,
    stepEndsAt: null,
  };
}

function eta(end: number, nextArrival?: number, partial = false): RouteEta {
  return { end, nextArrival, partial, estimated: true };
}

describe('lapMs', () => {
  it('sums every leg at 85% plus every wait', () => {
    const waypoints = [waypoint([step('LOAD')]), waypoint([step('WAIT', 30, 'MINUTES')])];
    expect(lapMs(waypoints, [3600, 7200])).toBe((10800 * LEG_ESTIMATE_FACTOR + 1800) * 1000);
  });

  it('has no length when a leg has no known time', () => {
    expect(lapMs([waypoint(), waypoint()], [3600, undefined])).toBeUndefined();
  });
});

describe('loadingAtOrigin', () => {
  it('counts the origin until its last load step has run', () => {
    expect(loadingAtOrigin(execution('RUNNING_STEPS', 0, 3), false)).toBe(true);
    expect(loadingAtOrigin(execution('STEP_BLOCKED', 0, 2), false)).toBe(true);
    expect(loadingAtOrigin(execution('PLANNING', 0, 0), true)).toBe(true);
  });

  it('does not count a load already taken, a flight in, or another stop', () => {
    expect(loadingAtOrigin(execution('PLANNING', 0, 4), true)).toBe(false);
    expect(loadingAtOrigin(execution('FLYING', 0), false)).toBe(false);
    expect(loadingAtOrigin(execution('PLANNING', 0), false)).toBe(false);
    expect(loadingAtOrigin(execution('RUNNING_STEPS', 1), false)).toBe(false);
  });
});

describe('nextLapStart', () => {
  it('is the arrival when the ship is flying back to the origin', () => {
    const next = nextLapStart(
      execution('FLYING', 0),
      eta(NOW + 9 * DAY_MS, NOW + DAY_MS),
      [3600, 3600],
    );
    expect(next.time).toBe(NOW + DAY_MS);
  });

  it('adds the return leg to the time the ship leaves its last stop', () => {
    const next = nextLapStart(
      execution('FLYING', 1),
      eta(NOW + DAY_MS, NOW + HOUR_MS),
      [7200, 3600],
    );
    expect(next.time).toBe(NOW + DAY_MS + 7200 * LEG_ESTIMATE_FACTOR * 1000);
    expect(next.partial).toBe(false);
  });

  it('marks the time partial when the return leg is unknown', () => {
    const next = nextLapStart(execution('FLYING', 1), eta(NOW + DAY_MS), [undefined, 3600]);
    expect(next).toEqual({ time: NOW + DAY_MS, partial: true });
  });

  it('has no next lap on a one-way route', () => {
    expect(nextLapStart(execution('FLYING', 1, 0, false), eta(NOW), [1, 1]).time).toBeUndefined();
  });
});

describe('lapStarts', () => {
  const base = { now: NOW, until: NOW + 10 * DAY_MS, loadingNow: false, repeats: true };

  it('repeats one lap length after the next lap, up to the horizon', () => {
    expect(lapStarts({ ...base, nextLap: NOW + DAY_MS, lapMs: 4 * DAY_MS })).toEqual([
      NOW + DAY_MS,
      NOW + 5 * DAY_MS,
      NOW + 9 * DAY_MS,
    ]);
  });

  it('puts a load still to come at the origin at now', () => {
    expect(
      lapStarts({ ...base, loadingNow: true, nextLap: NOW + 6 * DAY_MS, lapMs: 6 * DAY_MS }),
    ).toEqual([NOW, NOW + 6 * DAY_MS]);
  });

  it('counts only the next lap when the lap length is unknown', () => {
    expect(lapStarts({ ...base, nextLap: NOW + DAY_MS, lapMs: undefined })).toEqual([NOW + DAY_MS]);
  });

  it('counts a one-way route only while it is loading at the origin', () => {
    const oneWay = { ...base, repeats: false, nextLap: undefined, lapMs: DAY_MS };
    expect(lapStarts(oneWay)).toEqual([]);
    expect(lapStarts({ ...oneWay, loadingNow: true })).toEqual([NOW]);
  });
});

describe('firstShortDraw', () => {
  const draws: OriginDraw[] = [
    { time: NOW + 3 * DAY_MS, need: { RAT: 60 } },
    { time: NOW + DAY_MS, need: { RAT: 60, DW: 10 } },
    { time: NOW + 2 * DAY_MS, need: { DW: 10 } },
  ];

  it('is the first lap in time order that the remaining stock cannot load', () => {
    const short = firstShortDraw(draws, { RAT: 100, DW: 100 });
    expect(short?.time).toBe(NOW + 3 * DAY_MS);
    expect(countdownDays(NOW, short)).toBe(3);
  });

  it('is the first lap when stock is already short, and nothing when covered', () => {
    expect(countdownDays(NOW, firstShortDraw(draws, { RAT: 10, DW: 100 }))).toBe(1);
    expect(firstShortDraw(draws, { RAT: 120, DW: 20 })).toBeUndefined();
  });
});

describe('plannedDepartureTimes', () => {
  it('departs now and again each lap, at the 85% leg factor', () => {
    const step = (3600 + 3600) * LEG_ESTIMATE_FACTOR * 1000;
    expect(plannedDepartureTimes(NOW, NOW + step, [3600, 3600])).toEqual([NOW, NOW + step]);
  });

  it('does not step shorter than a minute', () => {
    expect(plannedDepartureTimes(NOW, NOW + 60_000, [1, 1])).toEqual([NOW, NOW + 60_000]);
  });

  it('is a single departure now when a leg has no known time', () => {
    expect(plannedDepartureTimes(NOW, NOW + 10 * DAY_MS, [3600, undefined])).toEqual([NOW]);
  });
});

describe('unassignedCxLoads', () => {
  it('draws a planned looping route at now and each later lap', () => {
    const step = 7200 * LEG_ESTIMATE_FACTOR * 1000;
    const plan = unassignedCxLoads({
      now: NOW,
      until: NOW + step,
      looping: true,
      cx: true,
      need: { RAT: 6 },
      legSeconds: [3600, 3600],
    });
    expect(plan.draws.map(draw => draw.time)).toEqual([NOW, NOW + step]);
    expect(plan.restockOnly).toEqual([]);
  });

  it('restocks a planned non-looping route once and does not reserve it', () => {
    const plan = unassignedCxLoads({
      now: NOW,
      until: NOW + 14 * DAY_MS,
      looping: false,
      cx: true,
      need: { RAT: 6 },
      legSeconds: [3600, 3600],
    });
    expect(plan.draws).toEqual([]);
    expect(plan.restockOnly).toEqual([{ time: NOW, need: { RAT: 6 } }]);
    // The reserve sums draws. The restock sums draws plus this one departure.
    expect(drawTotal(plan.draws, NOW + 14 * DAY_MS)).toEqual({});
    expect(drawTotal([...plan.draws, ...plan.restockOnly], NOW + 14 * DAY_MS)).toEqual({
      RAT: 6,
    });
  });

  it('leaves a base origin alone and marks an unknown CX lap partial', () => {
    expect(
      unassignedCxLoads({
        now: NOW,
        until: NOW + DAY_MS,
        looping: true,
        cx: false,
        need: { RAT: 6 },
        legSeconds: [3600],
      }),
    ).toEqual({ draws: [], restockOnly: [], partial: false });
    expect(
      unassignedCxLoads({
        now: NOW,
        until: NOW + DAY_MS,
        looping: true,
        cx: true,
        need: undefined,
        legSeconds: [3600],
      }).partial,
    ).toBe(true);
  });
});

describe('drawTotal', () => {
  it('adds every lap up to the resupply horizon, rounded up', () => {
    const draws: OriginDraw[] = [
      { time: NOW, need: { RAT: 10.2 } },
      { time: NOW + 5 * DAY_MS, need: { RAT: 10, DW: 3 } },
      { time: NOW + 20 * DAY_MS, need: { RAT: 99 } },
    ];
    expect(drawTotal(draws, NOW + 14 * DAY_MS)).toEqual({ RAT: 21, DW: 3 });
  });
});
