import { parseRouteId, parseRouteSpec } from '@src/features/XIT/RTACT/route-spec';
import { stagingRunBlock } from '@src/features/XIT/RTACT/staging-host';

export type StagingPackageResult =
  | { ok: true; pkg: UserData.ActionPackageData }
  | { ok: false; error: string };

// Off the staging host this returns an error and no package, so nothing is staged to run.
export function buildStagingPackage(
  hostname: string,
  routeIdRaw: string,
  specText: string,
): StagingPackageResult {
  const blocked = stagingRunBlock(hostname);
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
        },
      ],
    },
  };
}
