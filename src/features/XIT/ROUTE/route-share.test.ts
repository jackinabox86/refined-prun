import { describe, expect, it } from 'vitest';
import { exportRoute, importRoute } from '@src/features/XIT/ROUTE/route-share';
import { repeatOriginKey, stopInstanceKey } from '@src/features/XIT/ROUTE/route-stops';

const origin = { kind: 'cx' as const, id: 'AI1' };
const deimos = { kind: 'base' as const, id: 'ZV-759c' };
const phobos = { kind: 'base' as const, id: 'ZV-307d' };

function saved(): UserData.ShippingRoute {
  return {
    id: 'route-id',
    name: 'Route 1',
    stops: [origin, deimos, { ...origin, key: repeatOriginKey(origin) }, phobos],
    ship: 'AVI-00090',
    days: 7.5,
    loop: false,
    returnToOrigin: true,
    legs: [{ ok: true, seconds: 3600, fuelUsage: 0.05 }],
    rtId: 'RT-ZGIX-5381',
    legsAfterRt: true,
    wait: { amount: 3, unit: 'days' },
  };
}

describe('route export', () => {
  it('keeps the plan and leaves the flight times and game route behind', () => {
    expect(exportRoute(saved())).toEqual({
      format: 'rpr-route',
      version: 1,
      name: 'Route 1',
      stops: [origin, deimos, origin, phobos],
      ship: 'AVI-00090',
      supplyDays: 7.5,
      loop: false,
      returnToOrigin: true,
      wait: { amount: 3, unit: 'days' },
    });
  });

  it('writes an absent loop as a loop', () => {
    expect(exportRoute({ id: 'x', name: 'R', stops: [origin] }).loop).toBe(true);
  });
});

describe('route import', () => {
  it('round-trips an export, with a fresh key on each repeated origin', () => {
    const result = importRoute(JSON.stringify(exportRoute(saved())));
    if (!result.ok) {
      throw new Error(result.error);
    }
    const { stops, ...rest } = result.route;
    expect(rest).toEqual({
      name: 'Route 1',
      ship: 'AVI-00090',
      days: 7.5,
      loop: false,
      returnToOrigin: true,
      wait: { amount: 3, unit: 'days' },
    });
    expect(stops.map(stop => stop.id)).toEqual(['AI1', 'ZV-759c', 'AI1', 'ZV-307d']);
    expect(stops[0]?.key).toBeUndefined();
    expect(stops[2]?.key?.startsWith('cx:AI1#')).toBe(true);
    expect(new Set(stops.map(stopInstanceKey)).size).toBe(4);
  });

  it('takes a hand-written route with only stops', () => {
    const result = importRoute(
      '{"stops":[{"kind":"cx","id":" ai1 "},{"kind":"base","id":"ZV-759c"}]}',
    );
    expect(result).toEqual({
      ok: true,
      route: { name: 'Imported route', stops: [origin, deimos] },
    });
  });

  it('refuses a stop that repeats when it is not the origin', () => {
    const result = importRoute(JSON.stringify({ stops: [origin, deimos, phobos, deimos] }));
    expect(result).toEqual({
      ok: false,
      error: 'Stop 4 (ZV-759c) is already on the route. Only the first stop can repeat.',
    });
  });

  it('drops a zero wait and snaps supply days to the route step', () => {
    const result = importRoute(
      JSON.stringify({ stops: [origin], supplyDays: 2.26, wait: { amount: 0, unit: 'hours' } }),
    );
    expect(result).toEqual({
      ok: true,
      route: { name: 'Imported route', stops: [origin], days: 2.3 },
    });
  });

  it('carries a set delivery and stop steps both ways', () => {
    const route = saved();
    route.stops[1] = { ...deimos, supply: { RAT: 120 }, steps: ['unload ALO all all'] };
    route.stops[3] = { ...phobos, supply: {} };
    const json = exportRoute(route);
    expect(json.stops[1]).toEqual({
      ...deimos,
      supply: { RAT: 120 },
      steps: ['unload ALO all all'],
    });
    expect(json.stops[3]).toEqual({ ...phobos, supply: {} });
    const result = importRoute(JSON.stringify(json));
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.route.stops[1]).toEqual(json.stops[1]);
    expect(result.route.stops[3]).toEqual(json.stops[3]);
  });

  it.each([
    [
      '{"stops":[{"kind":"cx","id":"AI1","supply":{"RAT":5}}]}',
      'Stop 1 (AI1): supply is for bases only. Use steps on an exchange.',
    ],
    [
      '{"stops":[{"kind":"base","id":"ZV-759c","supply":{"RAT":1.5}}]}',
      'Stop 1 (ZV-759c): RAT amount must be a whole number, 0 or more.',
    ],
    [
      '{"stops":[{"kind":"cx","id":"AI1","steps":"load RAT 1 1"}]}',
      'Stop 1 (AI1): steps should be a list of strings.',
    ],
    [
      '{"stops":[{"kind":"cx","id":"AI1","steps":["load RAT 1 1","fly home"]}]}',
      'Stop 1 (AI1): step 2 (fly home): unknown step "fly".',
    ],
    ['not json', 'Invalid JSON.'],
    ['[]', 'Expected a JSON object.'],
    ['{"format":"contract","stops":[]}', 'Not a route (format must be "rpr-route").'],
    ['{"version":2,"stops":[]}', 'Route version 2 is newer than this extension.'],
    ['{"stops":[]}', 'Invalid stops (expected a list of {"kind": "cx" | "base", "id": ...}).'],
    [
      '{"stops":[{"kind":"ship","id":"AI1"}]}',
      'Invalid stop 1 (expected {"kind": "cx" | "base", "id": ...}).',
    ],
    ['{"stops":[{"kind":"cx","id":"  "}]}', 'Invalid stop 1 (empty id).'],
    ['{"stops":[{"kind":"cx","id":"AI1"}],"loop":"yes"}', 'Invalid loop (expected true or false).'],
    [
      '{"stops":[{"kind":"cx","id":"AI1"}],"supplyDays":-1}',
      'Invalid supplyDays (expected a number, 0 or more).',
    ],
    [
      '{"stops":[{"kind":"cx","id":"AI1"}],"wait":{"amount":3,"unit":"weeks"}}',
      'Invalid wait (expected {"amount": 3, "unit": "days"}).',
    ],
  ])('rejects %s', (text, error) => {
    expect(importRoute(text)).toEqual({ ok: false, error });
  });
});
