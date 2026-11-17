import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/infrastructure/prun-api/data/ship-routes', () => ({
  shipRoutesStore: { all: { value: [] } },
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
  ids: string[],
): PrunApi.ShipRouteExecution {
  return {
    state,
    route: { repeats, waypoints: ids.map(id => ({ id })) },
  } as unknown as PrunApi.ShipRouteExecution;
}

const byId = (waypoint: PrunApi.ShipRouteWaypoint) => waypoint.id;

describe('runningRouteStops', () => {
  it('includes every stop of a looping route that is running', () => {
    for (const state of ['FLYING', 'RUNNING_STEPS', 'WAITING'] as const) {
      const stops = runningRouteStops([execution(state, true, ['ANT', 'VH-331a'])], byId);
      expect(stops.has('VH-331a')).toBe(true);
    }
  });

  it('excludes a looping route blocked on a step', () => {
    const stops = runningRouteStops([execution('STEP_BLOCKED', true, ['ANT', 'VH-331a'])], byId);
    expect(stops.has('VH-331a')).toBe(false);
  });

  it('excludes a one-way route even while it runs', () => {
    const stops = runningRouteStops([execution('FLYING', false, ['ANT', 'VH-331a'])], byId);
    expect(stops.has('VH-331a')).toBe(false);
  });

  it('keeps a base served by a second, unblocked ship', () => {
    const stops = runningRouteStops(
      [
        execution('STEP_BLOCKED', true, ['ANT', 'VH-331a']),
        execution('FLYING', true, ['AI1', 'VH-331a']),
      ],
      byId,
    );
    expect(stops.has('VH-331a')).toBe(true);
    expect(stops.has('ANT')).toBe(false);
  });

  it('is empty without any route execution', () => {
    expect(runningRouteStops([], byId).size).toBe(0);
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
