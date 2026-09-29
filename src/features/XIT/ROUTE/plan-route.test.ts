import { describe, expect, it } from 'vitest';
import { planRouteLegs } from '@src/features/XIT/ROUTE/plan-route';
import { RouteStop } from '@src/features/XIT/ROUTE/resolve-route-stop';

function stop(query: string, label = query): RouteStop {
  return { raw: query, label, query };
}

describe('planRouteLegs', () => {
  it('rejects a route shorter than two stops', () => {
    expect(planRouteLegs([stop('VH-331a')]).error).toBe('Enter at least two stops');
  });

  it('pairs consecutive stops and keeps an unresolved stop as a leg error', () => {
    const unknown: RouteStop = { raw: 'NOPE', label: 'NOPE', error: 'unknown stop "NOPE"' };
    const planned = planRouteLegs([stop('VH-331a', 'Hortus a'), unknown, stop('ANT', 'Antares')]);
    expect(planned.legs).toEqual([
      {
        originLabel: 'Hortus a',
        destinationLabel: 'NOPE',
        originQuery: 'VH-331a',
        destinationQuery: undefined,
        error: 'unknown stop "NOPE"',
      },
      {
        originLabel: 'NOPE',
        destinationLabel: 'Antares',
        originQuery: undefined,
        destinationQuery: 'ANT',
        error: 'unknown stop "NOPE"',
      },
    ]);
  });

  it('errors a leg whose ends are the same place', () => {
    const planned = planRouteLegs([
      stop('VH-331a', 'Hortus a'),
      { raw: 'vh-331a', label: 'Hortus', query: 'vh-331a' },
    ]);
    expect(planned.legs[0]?.error).toBe('equal origin and destination');
  });
});
