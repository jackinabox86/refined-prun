import { describe, expect, it } from 'vitest';
import { STAGING_HOST } from '@src/features/XIT/RTACT/staging-host';
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

  it('returns the staging error off the staging host', () => {
    expect(buildRouteconfigPackage('apex.prosperousuniverse.com', spec, '', 'Milk')).toEqual({
      ok: false,
      error: `RT route runner is inert off ${STAGING_HOST}`,
    });
  });
});
