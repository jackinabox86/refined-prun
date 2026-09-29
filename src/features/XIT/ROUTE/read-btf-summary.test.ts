import { describe, expect, it } from 'vitest';
import {
  flightPlanFailure,
  formatDuration,
  summarizeFreshPlan,
} from '@src/features/XIT/ROUTE/read-btf-summary';
import { formatRouteTotal } from '@src/features/XIT/ROUTE/route-results';

const origin = 'IA-158b';
const destination = 'QJ-684d';

function address(naturalId: string, type: 'PLANET' | 'STATION', systemId: string): PrunApi.Address {
  return {
    lines: [
      { type: 'SYSTEM', entity: { id: systemId, naturalId: systemId, name: systemId } },
      { type, entity: { id: naturalId, naturalId, name: naturalId } },
    ],
  };
}

function segment(
  from: PrunApi.Address,
  to: PrunApi.Address,
  patch: Partial<PrunApi.FlightSegment> = {},
): PrunApi.FlightSegment {
  return {
    type: 'TRANSIT',
    origin: from,
    destination: to,
    departure: { timestamp: 0 },
    arrival: { timestamp: 0 },
    stlDistance: null,
    stlFuelConsumption: 1,
    transferEllipse: null,
    ftlDistance: null,
    ftlFuelConsumption: null,
    damage: 0,
    ...patch,
  };
}

function plan(patch: Partial<PrunApi.FlightPlan> = {}): PrunApi.FlightPlan {
  return {
    missionId: 'c37a17c2-0d6c-4308-b27c-a8c9e6275c34',
    segments: [
      segment(address(origin, 'PLANET', 'IA-158'), address(destination, 'PLANET', 'QJ-684')),
    ],
    status: 'OK',
    eta: { millis: 44586975 },
    chargeTime: { millis: 0 },
    stlDistance: null,
    stlFuelConsumption: 246,
    ftlDistance: null,
    ftlFuelConsumption: 39,
    minReactorUsageFactor: 0,
    maxReactorUsageFactor: 0,
    ...patch,
  };
}

function summarize(current: PrunApi.FlightPlan | undefined, previous?: PrunApi.FlightPlan) {
  return summarizeFreshPlan(current, previous, origin, destination);
}

describe('summarizeFreshPlan', () => {
  it('reads duration and fuel from the flight plan', () => {
    expect(summarize(plan())).toEqual({
      ok: true,
      duration: '12h 23m 7s',
      seconds: 44587,
      stl: 246,
      ftl: 39,
    });
  });

  it('keeps a zero FTL figure', () => {
    const summary = summarize(
      plan({ eta: { millis: 5932000 }, stlFuelConsumption: 226, ftlFuelConsumption: 0 }),
    );
    expect(summary).toMatchObject({ ok: true, seconds: 5932, stl: 226, ftl: 0 });
  });

  it('does not treat the plan already on screen as a new result', () => {
    const current = plan();
    expect(summarize(current, current)).toBeUndefined();
    expect(flightPlanFailure(current, origin, destination)).toBe('no flight plan');
  });

  it('accepts a replaced plan with the same figures', () => {
    const summary = summarize(plan(), plan());
    expect(summary).toMatchObject({ ok: true, stl: 246, ftl: 39 });
  });

  it('does not accept a new plan for a different destination', () => {
    const other = plan({
      segments: [
        segment(address(origin, 'PLANET', 'IA-158'), address('IA-158e', 'PLANET', 'IA-158')),
      ],
    });
    expect(summarize(other, plan())).toBeUndefined();
    expect(flightPlanFailure(other, origin, destination)).toBe('no flight plan');
  });

  it('matches a commodity exchange by station id, not system id', () => {
    const exchange = plan({
      segments: [segment(address('BEN', 'STATION', 'UV-351'), address('ANT', 'STATION', 'ZV-307'))],
    });
    expect(summarizeFreshPlan(exchange, undefined, 'BEN', 'ANT')).toMatchObject({
      ok: true,
      stl: 246,
      ftl: 39,
    });
    expect(summarizeFreshPlan(exchange, undefined, 'UV-351', 'ZV-307')).toBeUndefined();
  });

  it('uses the first origin and the last destination', () => {
    const routed = plan({
      segments: [
        segment(address(origin, 'PLANET', 'IA-158'), address('GTW', 'STATION', 'IA-158')),
        segment(address('GTW', 'STATION', 'QJ-684'), address(destination, 'PLANET', 'QJ-684')),
      ],
    });
    expect(summarize(routed)).toMatchObject({ ok: true });
  });

  it('does not invent fuel when the plan has no consumption', () => {
    const missing = plan({ stlFuelConsumption: null, ftlFuelConsumption: null });
    expect(summarize(missing)).toBeUndefined();
    expect(flightPlanFailure(missing, origin, destination)).toBe('no fuel figures');
  });

  it('does not accept a plan that failed to compute', () => {
    const failed = plan({ status: 'FAILED' });
    expect(summarize(failed)).toBeUndefined();
    expect(flightPlanFailure(failed, origin, destination)).toBe('no flight plan');
  });
});

describe('formatDuration', () => {
  it('omits zero seconds when a longer unit is present', () => {
    expect(formatDuration(5 * 3600 + 41 * 60)).toBe('5h 41m');
    expect(formatDuration(10)).toBe('10s');
  });
});

describe('formatRouteTotal', () => {
  it('sums resolved legs and calls out unresolved ones', () => {
    expect(formatRouteTotal([{ ok: true, seconds: 10, stl: 5, ftl: 1 }, { ok: false }])).toBe(
      'Total (1 leg): 10s, 5 STL + 1 FTL; 1 unresolved',
    );
  });
});
