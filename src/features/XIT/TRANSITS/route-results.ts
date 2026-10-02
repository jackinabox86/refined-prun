import { formatDuration } from '@src/features/XIT/TRANSITS/read-btf-summary';

export interface RecordedLeg {
  ok: boolean;
  seconds?: number;
  stl?: number;
  ftl?: number;
  gateway?: boolean;
}

export const routeResults = {
  legs: [] as RecordedLeg[],
  routeId: undefined as string | undefined,
  reset() {
    this.legs = [];
  },
};

export function formatRouteTotal(legs: RecordedLeg[]) {
  const resolved = legs.filter(x => x.ok && x.seconds !== undefined && x.stl !== undefined);
  if (resolved.length === 0) {
    return 'Total: no resolved legs';
  }
  const seconds = sumBy(resolved, x => x.seconds ?? 0);
  const stl = sumBy(resolved, x => x.stl ?? 0);
  const ftl = sumBy(resolved, x => x.ftl ?? 0);
  const unresolved = legs.length - resolved.length;
  const noun = resolved.length === 1 ? 'leg' : 'legs';
  const suffix = unresolved > 0 ? `; ${unresolved} unresolved` : '';
  return `Total (${resolved.length} ${noun}): ${formatDuration(seconds)}, ${stl} STL + ${ftl} FTL${suffix}`;
}

export function formatLegLine(
  label: string,
  summary: { duration: string; stl: number; ftl: number },
) {
  return `${label}: ${summary.duration}, ${summary.stl} STL + ${summary.ftl} FTL`;
}
