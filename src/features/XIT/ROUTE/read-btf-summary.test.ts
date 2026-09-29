import { describe, expect, it } from 'vitest';
import {
  flightPlanFailure,
  formatDuration,
  summarizeFreshPlan,
} from '@src/features/XIT/ROUTE/read-btf-summary';
import { formatRouteTotal } from '@src/features/XIT/ROUTE/route-results';

function plan(patch: Partial<PrunApi.FlightPlan> = {}): PrunApi.FlightPlan {
  return {
    missionId: 'c37a17c2-0d6c-4308-b27c-a8c9e6275c34',
    segments: [],
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

describe('summarizeFreshPlan', () => {
  it('reads duration and fuel from the flight plan', () => {
    expect(summarizeFreshPlan(plan(), undefined)).toEqual({
      ok: true,
      duration: '12h 23m 7s',
      seconds: 44587,
      stl: 246,
      ftl: 39,
    });
  });

  it('keeps a zero FTL figure', () => {
    const summary = summarizeFreshPlan(
      plan({ eta: { millis: 5932000 }, stlFuelConsumption: 226, ftlFuelConsumption: 0 }),
      undefined,
    );
    expect(summary).toMatchObject({ ok: true, seconds: 5932, stl: 226, ftl: 0 });
  });

  it('does not treat the plan already on screen as a new result', () => {
    const current = plan();
    expect(summarizeFreshPlan(current, current)).toBeUndefined();
    expect(flightPlanFailure(current)).toBe('no flight plan');
  });

  it('accepts a replaced plan with the same figures', () => {
    const summary = summarizeFreshPlan(plan(), plan());
    expect(summary).toMatchObject({ ok: true, stl: 246, ftl: 39 });
  });

  it('does not invent fuel when the plan has no consumption', () => {
    const missing = plan({ stlFuelConsumption: null, ftlFuelConsumption: null });
    expect(summarizeFreshPlan(missing, undefined)).toBeUndefined();
    expect(flightPlanFailure(missing)).toBe('no fuel figures');
  });

  it('does not accept a plan that failed to compute', () => {
    const failed = plan({ status: 'FAILED' });
    expect(summarizeFreshPlan(failed, undefined)).toBeUndefined();
    expect(flightPlanFailure(failed)).toBe('no flight plan');
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
