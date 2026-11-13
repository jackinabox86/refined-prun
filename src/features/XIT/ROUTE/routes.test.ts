import { beforeEach, describe, expect, it } from 'vitest';
import { transitStopIds } from '@src/features/XIT/ROUTE/route-calc';
import { createRoute, saveRouteLegs } from '@src/features/XIT/ROUTE/routes';
import { applyInitialUserData } from '@src/store/user-data';

function base(id: string): UserData.ShippingRouteStop {
  return { kind: 'base', id };
}

// One leg per trip, each with its own fuel usage, so a leg on the wrong trip shows.
function legsFor(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ok: true,
    seconds: 3600 * (i + 1),
    stl: 10 * (i + 1),
    ftl: 0,
    fuelUsage: (i + 1) / 10,
  }));
}

describe('saveRouteLegs', () => {
  beforeEach(() => {
    applyInitialUserData();
  });

  it('saves the legs of a run flown over the route stops, in trip order', () => {
    const route = createRoute();
    route.stops = ['A', 'B', 'C', 'D', 'E'].map(base);
    const stops = transitStopIds(route.stops, route.loop);

    expect(saveRouteLegs(route.id, stops, legsFor(5))).toBe(true);

    expect(route.legs?.map(x => x.fuelUsage)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it('does not save legs flown over a stop order the route no longer has', () => {
    const route = createRoute();
    route.stops = ['A', 'B', 'C', 'D', 'E'].map(base);
    const flown = transitStopIds(route.stops, route.loop);
    // ROUTECONFIG reorders the stops while TRANSITS still holds the old order.
    route.stops = ['A', 'E', 'D', 'C', 'B'].map(base);
    route.legs = undefined;

    expect(saveRouteLegs(route.id, flown, legsFor(5))).toBe(false);

    expect(route.legs).toBeUndefined();
  });

  it('does not save legs flown over hand-edited stops', () => {
    const route = createRoute();
    route.stops = ['A', 'B', 'C'].map(base);
    route.loop = false;

    expect(saveRouteLegs(route.id, ['A', 'C', 'B'], legsFor(2))).toBe(false);
    expect(saveRouteLegs(route.id, ['A', 'B', 'C', 'A'], legsFor(3))).toBe(false);

    expect(route.legs).toBeUndefined();
  });

  it('accepts a run without a route', () => {
    expect(saveRouteLegs(undefined, ['A', 'B'], legsFor(1))).toBe(true);
  });
});
