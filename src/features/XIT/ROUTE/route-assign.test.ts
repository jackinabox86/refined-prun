import { describe, expect, it } from 'vitest';
import {
  assignShortfall,
  cargoFits,
  gameRouteIdFor,
  shortfallMaterials,
  splitRouteSections,
} from '@src/features/XIT/ROUTE/route-assign';

function route(loop: boolean | undefined, id = 'a'): UserData.ShippingRoute {
  return {
    id,
    name: id,
    stops: [
      { kind: 'cx', id: 'AI1' },
      { kind: 'base', id: 'ZV-759c' },
    ],
    loop,
    ship: 'AVI-00090',
  };
}

describe('splitRouteSections', () => {
  it('puts loop === false first and leaves the other routes looping', () => {
    const off = route(false, 'off');
    const absent = route(undefined, 'absent');
    const on = route(true, 'on');
    expect(splitRouteSections([on, off, absent])).toEqual({
      nonLooping: [off],
      looping: [on, absent],
    });
  });
});

describe('assignShortfall', () => {
  it('does not take the loop reserve', () => {
    // Stock covers the bill. The reserve does not, so the route is still short.
    const lines = assignShortfall({ RAT: 10 }, { RAT: 12 }, { RAT: 8 });
    expect(lines).toEqual([{ ticker: 'RAT', need: 10, free: 4, short: 6 }]);
  });

  it('buys nothing when free stock covers the bill', () => {
    expect(assignShortfall({ RAT: 10 }, { RAT: 18 }, { RAT: 8 })).toEqual([
      { ticker: 'RAT', need: 10, free: 10, short: 0 },
    ]);
    expect(shortfallMaterials(assignShortfall({ RAT: 10 }, { RAT: 18 }, { RAT: 8 }))).toEqual({});
  });

  it('treats a missing ticker as empty', () => {
    expect(assignShortfall({ DW: 3 }, {}, { DW: 1 })).toEqual([
      { ticker: 'DW', need: 3, free: 0, short: 3 },
    ]);
  });
});

describe('gameRouteIdFor', () => {
  const resolve = (stop: UserData.ShippingRouteStop) => (stop.kind === 'cx' ? 'ANT' : stop.id);

  it('uses the id recorded when the route was built', () => {
    const saved = { ...route(false), rtId: 'RT-AAAA-0001' };
    expect(gameRouteIdFor(saved, [], resolve)).toBe('RT-AAAA-0001');
  });

  it('matches one non-looping execution with the same stops', () => {
    const saved = route(false);
    expect(
      gameRouteIdFor(
        saved,
        [
          { naturalId: 'RT-LOOP-0001', repeats: true, waypointIds: ['ANT', 'ZV-759c'] },
          { naturalId: 'RT-ONCE-0002', repeats: false, waypointIds: ['ANT', 'ZV-759c'] },
        ],
        resolve,
      ),
    ).toBe('RT-ONCE-0002');
  });

  it('stays unset when two game routes match', () => {
    const saved = route(false);
    expect(
      gameRouteIdFor(
        saved,
        [
          { naturalId: 'RT-ONCE-0002', repeats: false, waypointIds: ['ANT', 'ZV-759c'] },
          { naturalId: 'RT-ONCE-0003', repeats: false, waypointIds: ['ANT', 'ZV-759c'] },
        ],
        resolve,
      ),
    ).toBeUndefined();
  });
});

describe('cargoFits', () => {
  const specs = { RAT: { weight: 1, volume: 2 } };

  it('accepts a hold that covers the bill', () => {
    expect(cargoFits({ RAT: 4 }, specs, { weightCapacity: 4, volumeCapacity: 8 })).toBe(true);
  });

  it('rejects a hold that is short on volume', () => {
    expect(cargoFits({ RAT: 4 }, specs, { weightCapacity: 100, volumeCapacity: 7 })).toBe(false);
  });

  it('rejects an unknown material', () => {
    expect(cargoFits({ DW: 1 }, specs, { weightCapacity: 100, volumeCapacity: 100 })).toBe(false);
  });
});
