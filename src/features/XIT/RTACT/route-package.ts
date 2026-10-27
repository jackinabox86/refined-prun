import type { RouteSpec } from '@src/features/XIT/RTACT/route-spec';
import { stagingRunBlock } from '@src/features/XIT/RTACT/staging-host';
import type { StagingPackageResult } from '@src/features/XIT/RTACT/staging-package';

// Hands a built RouteSpec to the staging RT runner. Off staging this returns no package.
export function buildRouteconfigPackage(
  hostname: string,
  spec: RouteSpec,
  shipId: string,
  routeName: string,
  configRouteId?: string,
): StagingPackageResult {
  const blocked = stagingRunBlock(hostname);
  if (blocked !== undefined) {
    return { ok: false, error: blocked };
  }
  if (spec.stops.length < 2) {
    return { ok: false, error: 'Need at least 2 stops' };
  }
  const name = routeName.trim().length > 0 ? routeName.trim() : 'Route';
  const ship = shipId.trim();
  return {
    ok: true,
    pkg: {
      global: { name: `RT ${name}` },
      groups: [],
      actions: [
        {
          type: 'Staging RT',
          name: 'Build route',
          routePayload: JSON.stringify(spec),
          shipId: ship.length > 0 ? ship : undefined,
          configRouteId,
        },
      ],
    },
  };
}
