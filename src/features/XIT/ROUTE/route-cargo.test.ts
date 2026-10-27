import { afterEach, describe, expect, it, vi } from 'vitest';
import '@src/utils/dayjs';
// The module graph reaches shell/config, which reads `document` at import time.
vi.mock('@src/infrastructure/shell/config', () => ({ default: {} }));
import {
  checkSupply,
  formatSupply,
  parseStopSteps,
  parseSupplyText,
  splitStepsText,
} from '@src/features/XIT/ROUTE/route-cargo';
import { routeBaseBills } from '@src/features/XIT/ROUTE/route-load';
import { buildRouteSpec, type RouteBuildInput } from '@src/features/XIT/ROUTE/route-rt';
import { dispatch } from '@src/infrastructure/prun-api/data/api-messages';
import { request } from '@src/infrastructure/prun-api/data/request-hooks';

function site(siteId: string, naturalId: string): PrunApi.Site {
  return {
    siteId,
    address: {
      lines: [
        { type: 'SYSTEM', entity: { id: 'system-1', naturalId: 'ZV', name: 'ZV' } },
        { type: 'PLANET', entity: { id: `planet-${naturalId}`, naturalId, name: naturalId } },
      ],
    },
    founded: { timestamp: 0 },
    platforms: [],
    buildOptions: { options: [] },
    area: 0,
    investedPermits: 0,
    maximumPermits: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  dispatch({ type: 'CLIENT_CONNECTION_OPENED', data: {} });
});

describe('supply text', () => {
  it('reads a delivery, none, and empty', () => {
    expect(parseSupplyText('rat 120, DW 80')).toEqual({ ok: true, supply: { RAT: 120, DW: 80 } });
    expect(parseSupplyText(' none ')).toEqual({ ok: true, supply: {} });
    expect(parseSupplyText('  ')).toEqual({ ok: true });
  });

  it('refuses a bad amount, a bad ticker, a repeat, and a missing amount', () => {
    expect(parseSupplyText('RAT 1.5').ok).toBe(false);
    expect(parseSupplyText('RAT -1').ok).toBe(false);
    expect(parseSupplyText('TOOLONG 5').ok).toBe(false);
    expect(parseSupplyText('RAT 5, rat 6').ok).toBe(false);
    expect(parseSupplyText('RAT').ok).toBe(false);
  });

  it('drops zero amounts and formats back to the same text', () => {
    expect(checkSupply({ RAT: 0, dw: 3 })).toEqual({ ok: true, supply: { DW: 3 } });
    expect(checkSupply([1]).ok).toBe(false);
    expect(checkSupply({ RAT: '5' }).ok).toBe(false);
    expect(formatSupply({ RAT: 120, DW: 80 })).toBe('RAT 120, DW 80');
    expect(formatSupply({})).toBe('none');
    expect(formatSupply(undefined)).toBe('');
  });
});

describe('stop steps', () => {
  it('parses the XIT RTACT step syntax and names the bad step', () => {
    const lines = splitStepsText('unload ALO all all | | load DW 0 capacity retain 20');
    expect(lines).toEqual(['unload ALO all all', 'load DW 0 capacity retain 20']);
    expect(parseStopSteps(lines)).toEqual({
      ok: true,
      steps: [
        { kind: 'unload', ticker: 'ALO', min: { mode: 'all' }, max: { mode: 'all' } },
        {
          kind: 'load',
          ticker: 'DW',
          min: { mode: 'units', amount: 0 },
          max: { mode: 'capacity' },
          retain: 20,
        },
      ],
    });
    expect(parseStopSteps(['wait 2 hours', 'unload DW capacity all'])).toEqual({
      ok: false,
      error: 'step 2 (unload DW capacity all): unload uses units or all, not capacity',
    });
  });
});

describe('set delivery in the load plan', () => {
  it('bills the set delivery without burn data, and the supply-days bill still needs it', () => {
    vi.spyOn(request, 'production').mockImplementation(() => undefined);
    vi.spyOn(request, 'workforce').mockImplementation(() => undefined);
    dispatch({ type: 'SITE_SITES', data: { sites: [site('site-1', 'ZV-759c')] } });
    const stops = [
      { kind: 'cx' as const, id: 'AI1' },
      { kind: 'base' as const, id: 'ZV-759c', supply: { RAT: 120 } },
    ];
    const billed = routeBaseBills(stops, 7, [undefined, { stl: 10.2, ftl: 0 }] as never);
    expect(billed?.map(x => [x.naturalId, x.bill])).toEqual([['ZV-759c', { RAT: 120, SF: 11 }]]);
    // The planner adds fuel to its own copy, not to the saved delivery.
    expect(stops[1]!.supply).toEqual({ RAT: 120 });
    expect(routeBaseBills([stops[0]!, { kind: 'base', id: 'ZV-759c' }], 7, [])).toBeUndefined();
  });
});

describe('stop steps on the built route', () => {
  function input(loop: boolean): RouteBuildInput {
    return {
      stops: [
        { kind: 'cx', id: 'AI1', steps: [{ kind: 'wait', amount: 1, unit: 'hours' }] },
        {
          kind: 'base',
          id: 'ZV-759c',
          steps: [{ kind: 'unload', ticker: 'ALO', min: { mode: 'all' }, max: { mode: 'all' } }],
        },
        {
          kind: 'cx',
          id: 'AI1',
          steps: [
            {
              kind: 'load',
              ticker: 'ALO',
              min: { mode: 'units', amount: 5 },
              max: { mode: 'units', amount: 5 },
            },
          ],
        },
      ],
      loop,
      bills: [{ id: 'ZV-759c', bill: { RAT: 2 } }],
      sourced: {},
      loadedByStop: new Map(),
      refuelStl: [false, false, false],
      refuelFtl: [false, false, false],
      wait: { amount: 1, unit: 'days' },
    };
  }

  it("runs a stop's own steps after its planned ones, before the route wait", () => {
    const built = buildRouteSpec(input(false));
    if (!built.ok) {
      throw new Error(built.error);
    }
    const [origin, base, home] = built.spec.stops;
    expect(origin!.steps.at(-1)).toEqual({ kind: 'wait', amount: 1, unit: 'hours' });
    expect(origin!.steps.at(-2)).toMatchObject({ kind: 'load', ticker: 'RAT' });
    expect(base!.steps.map(x => x.kind)).toEqual(['unload', 'load', 'unload']);
    expect(base!.steps.at(-1)).toMatchObject({ kind: 'unload', ticker: 'ALO' });
    // The one-way return home has no planned steps, but its own still run.
    expect(home!.steps).toEqual([
      {
        kind: 'load',
        ticker: 'ALO',
        min: { mode: 'units', amount: 5 },
        max: { mode: 'units', amount: 5 },
      },
      { kind: 'wait', amount: 1440, unit: 'minutes' },
    ]);
  });
  it('runs them on a route that visits its origin twice', () => {
    const base = input(true);
    const stops = [base.stops[0]!, base.stops[1]!, { ...base.stops[2]!, key: 'cx:AI1#2' }];
    const segment = { bills: base.bills, sourced: {}, loadedByStop: new Map() };
    const built = buildRouteSpec({
      ...base,
      stops,
      segments: [
        { ...segment, originIndex: 0 },
        { ...segment, bills: [], originIndex: 2 },
      ],
    });
    if (!built.ok) {
      throw new Error(built.error);
    }
    expect(built.spec.stops.map(x => x.steps.at(-1)?.kind)).toEqual(['wait', 'unload', 'wait']);
    expect(built.spec.stops[2]!.steps.at(-2)).toMatchObject({ kind: 'load', ticker: 'ALO' });
  });
});
