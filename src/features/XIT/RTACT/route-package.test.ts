import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOST, STAGING_HOST } from '@src/features/XIT/RTACT/rt-host';
import { buildRouteconfigPackage } from '@src/features/XIT/RTACT/route-package';
import type { RouteSpec } from '@src/features/XIT/RTACT/route-spec';

const spec: RouteSpec = {
  loop: true,
  stops: [
    { query: 'ANT', steps: [] },
    { query: 'ZV-307d', steps: [], fuelUsage: 80, gateway: true },
  ],
};

describe('buildRouteconfigPackage', () => {
  it('stages the built spec on the staging host', () => {
    const result = buildRouteconfigPackage(STAGING_HOST, spec, ' AVI-0008Z ', 'Milk');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pkg.global.name).toBe('RT Milk');
    expect(result.pkg.actions[0]?.type).toBe('Staging RT');
    expect(result.pkg.actions[0]?.shipId).toBe('AVI-0008Z');
    expect(JSON.parse(result.pkg.actions[0]?.routePayload ?? '')).toEqual(spec);
  });

  it('stages the built spec on the production host', () => {
    const result = buildRouteconfigPackage(PRODUCTION_HOST, spec, '', 'Milk');
    expect(result.ok).toBe(true);
  });

  it('returns the host error off the APEX game hosts', () => {
    expect(buildRouteconfigPackage('example.com', spec, '', 'Milk')).toEqual({
      ok: false,
      error: `RT route runner only runs on ${PRODUCTION_HOST}`,
    });
  });
});
