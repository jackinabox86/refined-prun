import { describe, expect, it } from 'vitest';
import {
  configLegSeconds,
  LEG_ESTIMATE_FACTOR,
  matchConfigRoute,
  routeEta,
  stepSeconds,
} from '@src/features/XIT/ROUTE/route-eta';

const HOUR = 60 * 60;
const NOW = 1_000_000_000;

function step(type: string, amount?: number, unit?: string): PrunApi.ShipRouteStep {
  return { id: `${type}${amount ?? ''}`, type, amount, unit };
}

function waypoint(steps: PrunApi.ShipRouteStep[] = []) {
  return { steps } as PrunApi.ShipRouteWaypoint;
}

function execution(
  state: PrunApi.ShipRouteExecutionState,
  waypointIndex: number,
  waypoints: PrunApi.ShipRouteWaypoint[],
  extra: Partial<PrunApi.ShipRouteExecution> = {},
): PrunApi.ShipRouteExecution {
  return {
    shipId: 'ship',
    route: { repeats: false, waypoints } as PrunApi.ShipRoute,
    state,
    waypointIndex,
    stepIndex: 0,
    flightId: null,
    stepStartedAt: null,
    stepEndsAt: null,
    ...extra,
  };
}

describe('stepSeconds', () => {
  it('counts only wait steps and converts their unit', () => {
    expect(stepSeconds(step('LOAD'))).toBe(0);
    expect(stepSeconds(step('WAIT', 2, 'MINUTES'))).toBe(120);
    expect(stepSeconds(step('WAIT', 3, 'HOURS'))).toBe(3 * HOUR);
    expect(stepSeconds(step('WAIT', 2, 'FORTNIGHTS'))).toBeUndefined();
  });
});

describe('routeEta', () => {
  it('uses the live flight arrival, then cuts unflown legs to 85% of the raw test flight', () => {
    const waypoints = [waypoint([step('LOAD')]), waypoint([step('UNLOAD')]), waypoint()];
    const eta = routeEta({
      execution: execution('FLYING', 0, waypoints, { flightId: 'f' }),
      now: NOW,
      flightArrival: NOW + HOUR * 1000,
      atWaypoint: false,
      legSeconds: [undefined, 10 * HOUR, 4 * HOUR],
    });
    expect(eta.nextArrival).toBe(NOW + HOUR * 1000);
    expect(eta.end).toBe(NOW + (HOUR + 14 * HOUR * LEG_ESTIMATE_FACTOR) * 1000);
    expect(eta.partial).toBe(false);
    expect(eta.estimated).toBe(true);
  });

  it('does not pad an unflown leg', () => {
    const eta = routeEta({
      execution: execution('PLANNING', 1, [waypoint(), waypoint()]),
      now: NOW,
      flightArrival: undefined,
      atWaypoint: false,
      legSeconds: [undefined, HOUR],
    });
    // The padLegSeconds rule would make this one hour leg three hours.
    expect(eta.end - NOW).toBe(HOUR * 0.85 * 1000);
    expect(eta.nextArrival).toBe(eta.end);
  });

  it('ends a running wait at stepEndsAt and adds the waits after it', () => {
    const waypoints = [
      waypoint([step('WAIT', 10, 'MINUTES'), step('WAIT', 5, 'MINUTES'), step('LOAD')]),
    ];
    const eta = routeEta({
      execution: execution('WAITING', 0, waypoints, {
        stepEndsAt: { timestamp: NOW + 60_000 },
      }),
      now: NOW,
      flightArrival: undefined,
      atWaypoint: true,
      legSeconds: [],
    });
    expect(eta.nextArrival).toBeUndefined();
    expect(eta.end).toBe(NOW + 60_000 + 5 * 60_000);
    expect(eta.estimated).toBe(false);
  });

  it('skips the leg when the ship already sits at the waypoint it is planning for', () => {
    const eta = routeEta({
      execution: execution('PLANNING', 0, [waypoint(), waypoint()]),
      now: NOW,
      flightArrival: undefined,
      atWaypoint: true,
      legSeconds: [2 * HOUR, HOUR],
    });
    expect(eta.nextArrival).toBeUndefined();
    expect(eta.end - NOW).toBe(HOUR * 0.85 * 1000);
  });

  it('flags a lower bound when a leg has no test flight', () => {
    const eta = routeEta({
      execution: execution('RUNNING_STEPS', 0, [waypoint(), waypoint(), waypoint()]),
      now: NOW,
      flightArrival: undefined,
      atWaypoint: true,
      legSeconds: [undefined, undefined, HOUR],
    });
    expect(eta.partial).toBe(true);
    expect(eta.end - NOW).toBe(HOUR * 0.85 * 1000);
  });
});

describe('configLegSeconds', () => {
  const saved = {
    id: 'r',
    name: 'Route 1',
    stops: [
      { kind: 'cx', id: 'AI1' },
      { kind: 'base', id: 'ZV-759c' },
    ],
    legs: [
      { ok: true, seconds: 100 },
      { ok: true, seconds: 200 },
    ],
  } as UserData.ShippingRoute;

  it('gives the first waypoint the return leg only on a loop', () => {
    expect(configLegSeconds(saved, true)).toEqual([200, 100]);
    expect(configLegSeconds(saved, false)).toEqual([undefined, 100]);
  });

  it('drops a leg whose test flight failed', () => {
    const failed = { ...saved, legs: [{ ok: false, seconds: 100 }] };
    expect(configLegSeconds(failed, false)).toEqual([undefined, undefined]);
  });
});

describe('matchConfigRoute', () => {
  const resolve = (stop: UserData.ShippingRouteStop) => (stop.kind === 'cx' ? 'ANT' : stop.id);
  const a = {
    id: 'a',
    name: 'A',
    stops: [
      { kind: 'cx', id: 'AI1' },
      { kind: 'base', id: 'ZV-759c' },
    ],
  } as UserData.ShippingRoute;
  const b = { ...a, id: 'b', ship: 'AVI-00090' };
  const other = { ...a, id: 'c', stops: [{ kind: 'base', id: 'ZV-759c' }] } as typeof a;

  it('matches the stop sequence and prefers the same ship', () => {
    expect(matchConfigRoute(['ANT', 'ZV-759c'], 'AVI-00090', [a, b, other], resolve)?.id).toBe('b');
    expect(matchConfigRoute(['ANT', 'ZV-759c'], 'AVI-0008Z', [a, b, other], resolve)?.id).toBe('a');
    expect(
      matchConfigRoute(['ZV-759c', 'ANT'], 'AVI-00090', [a, b, other], resolve),
    ).toBeUndefined();
  });
});
