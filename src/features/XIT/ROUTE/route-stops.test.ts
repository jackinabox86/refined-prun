import { describe, expect, it } from 'vitest';
import {
  acceptDroppedStop,
  originVisitIndexes,
  routeSegments,
  stopInstanceKey,
} from '@src/features/XIT/ROUTE/route-stops';

describe('route stop identity', () => {
  const origin = { kind: 'cx' as const, id: 'AI1' };
  const base = { kind: 'base' as const, id: 'ZV-759c' };

  it('keeps a stop that is not on the route and refuses a second copy of any other stop', () => {
    expect(acceptDroppedStop([], origin)).toEqual(origin);
    expect(acceptDroppedStop([origin, base], base)).toBeUndefined();
  });

  it('gives a repeated origin its own key', () => {
    const accepted = acceptDroppedStop([origin, base], origin);
    expect(accepted?.id).toBe('AI1');
    expect(accepted?.key?.startsWith('cx:AI1#')).toBe(true);
    expect(stopInstanceKey(origin)).toBe('cx:AI1');
    expect(accepted?.key).not.toBe(stopInstanceKey(origin));
  });

  it('splits the route at each later visit of the first stop', () => {
    const stops = [origin, base, origin, { kind: 'base' as const, id: 'ZV-307d' }];
    expect(originVisitIndexes(stops)).toEqual([0, 2]);
    expect(routeSegments(stops).map(segment => segment.map(stop => stop.id))).toEqual([
      ['AI1', 'ZV-759c'],
      ['AI1', 'ZV-307d'],
    ]);
  });
});
