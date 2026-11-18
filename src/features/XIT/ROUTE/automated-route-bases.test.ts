import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/infrastructure/prun-api/data/ship-routes', () => ({
  shipRoutesStore: { all: { value: [] } },
}));
vi.mock('@src/infrastructure/prun-api/data/exchanges', () => ({
  exchangesStore: { getNaturalIdFromCode: () => undefined },
}));
vi.mock('@src/store/user-data', () => ({
  userData: { routes: [] },
}));
vi.mock('@src/infrastructure/prun-api/data/addresses', () => ({
  getEntityNaturalIdFromAddress: () => undefined,
}));

import {
  compareEnRouteLast,
  hasRepairsDue,
  runningRouteStops,
} from '@src/features/XIT/ROUTE/automated-route-bases';

function execution(
  state: PrunApi.ShipRouteExecutionState,
  repeats: boolean,
  naturalId: string,
  ids: string[],
): PrunApi.ShipRouteExecution {
  return {
    state,
    route: { naturalId, repeats, waypoints: ids.map(id => ({ id })) },
  } as unknown as PrunApi.ShipRouteExecution;
}

function saved(stops: string[], extra: Partial<UserData.ShippingRoute> = {}) {
  return {
    id: 'r',
    name: 'r',
    stops: stops.map(id => ({ kind: id.includes('-') ? 'base' : 'cx', id })),
    ...extra,
  } as UserData.ShippingRoute;
}

const byId = (waypoint: PrunApi.ShipRouteWaypoint) => waypoint.id;
const stopId = (stop: UserData.ShippingRouteStop) => stop.id;

function stops(executions: PrunApi.ShipRouteExecution[], routes: UserData.ShippingRoute[]) {
  return runningRouteStops(executions, routes, byId, stopId);
}

describe('runningRouteStops', () => {
  it('includes base stops of a looping ROUTECONFIG route that is running', () => {
    for (const state of ['FLYING', 'RUNNING_STEPS', 'WAITING'] as const) {
      const ids = stops(
        [execution(state, true, 'RT-1', ['ANT', 'VH-331a'])],
        [saved(['ANT', 'VH-331a'])],
      );
      expect(ids.has('VH-331a')).toBe(true);
      expect(ids.has('ANT')).toBe(false);
    }
  });

  it('matches by stored rtId even when the stops differ', () => {
    const ids = stops(
      [execution('FLYING', true, 'RT-1', ['AI1', 'VH-331a'])],
      [saved(['ANT', 'VH-331a'], { rtId: 'RT-1' })],
    );
    expect(ids.has('VH-331a')).toBe(true);
  });

  it('excludes a running loop made outside ROUTECONFIG', () => {
    const ids = stops([execution('FLYING', true, 'RT-1', ['ANT', 'VH-331a'])], []);
    expect(ids.has('VH-331a')).toBe(false);
  });

  it('excludes a ROUTECONFIG route whose stored game route is a different one', () => {
    const ids = stops(
      [execution('FLYING', true, 'RT-2', ['ANT', 'VH-331a'])],
      [saved(['ANT', 'VH-331a'], { rtId: 'RT-1' })],
    );
    expect(ids.has('VH-331a')).toBe(false);
  });

  it('excludes a looping route blocked on a step', () => {
    const ids = stops(
      [execution('STEP_BLOCKED', true, 'RT-1', ['ANT', 'VH-331a'])],
      [saved(['ANT', 'VH-331a'], { rtId: 'RT-1' })],
    );
    expect(ids.has('VH-331a')).toBe(false);
  });

  it('excludes one-way routes', () => {
    const ids = stops(
      [execution('FLYING', false, 'RT-1', ['ANT', 'VH-331a'])],
      [saved(['ANT', 'VH-331a'], { rtId: 'RT-1', loop: false })],
    );
    expect(ids.has('VH-331a')).toBe(false);
  });

  it('excludes a saved looping route no ship is running', () => {
    expect(stops([], [saved(['ANT', 'VH-331a'], { rtId: 'RT-1' })]).size).toBe(0);
  });
});

describe('hasRepairsDue', () => {
  it('is true at and past the repair target', () => {
    expect(hasRepairsDue(60, 60)).toBe(true);
    expect(hasRepairsDue(80, 60)).toBe(true);
  });

  it('is false before the target or without an age', () => {
    expect(hasRepairsDue(59, 60)).toBe(false);
    expect(hasRepairsDue(undefined, 60)).toBe(false);
  });
});

describe('compareEnRouteLast', () => {
  it('puts an en-route base after an off-route base', () => {
    expect(compareEnRouteLast(true, false)).toBe(1);
    expect(compareEnRouteLast(false, true)).toBe(-1);
    expect(compareEnRouteLast(true, true)).toBe(0);
  });

  it('lets repairs due break through only when that option is on', () => {
    expect(
      compareEnRouteLast(true, false, {
        repairsDueBreaksThrough: true,
        aRepairsDue: true,
        bRepairsDue: false,
      }),
    ).toBe(0);
    expect(
      compareEnRouteLast(true, false, {
        repairsDueBreaksThrough: true,
        aRepairsDue: false,
        bRepairsDue: false,
      }),
    ).toBe(1);
    expect(
      compareEnRouteLast(true, false, {
        aRepairsDue: true,
        bRepairsDue: false,
      }),
    ).toBe(1);
  });
});
