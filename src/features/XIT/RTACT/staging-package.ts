import { parseRouteId, parseRouteSpec } from '@src/features/XIT/RTACT/route-spec';
import { rtRunBlock } from '@src/features/XIT/RTACT/rt-host';

export type StagingPackageResult =
  | { ok: true; pkg: UserData.ActionPackageData }
  | { ok: false; error: string };

// Off the APEX game hosts this returns an error and no package, so nothing is staged to run.
export function buildStagingPackage(
  hostname: string,
  routeIdRaw: string,
  specText: string,
  shipId = '',
): StagingPackageResult {
  const blocked = rtRunBlock(hostname);
  if (blocked !== undefined) {
    return { ok: false, error: blocked };
  }
  const routeId = parseRouteId(routeIdRaw);
  if (!routeId.ok) {
    return routeId;
  }
  const spec = parseRouteSpec(specText);
  if (!spec.ok) {
    return spec;
  }
  const name = routeId.id !== undefined ? `Staging RT ${routeId.id}` : 'Staging RT new route';
  return {
    ok: true,
    pkg: {
      global: { name },
      groups: [],
      actions: [
        {
          type: 'Staging RT',
          name: 'Build route',
          routeId: routeId.id,
          routeSpec: specText,
          shipId: shipId.trim().length > 0 ? shipId.trim() : undefined,
        },
      ],
    },
  };
}
