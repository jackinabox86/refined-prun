import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';

export type BtfSummary =
  | { ok: true; duration: string; seconds: number; stl: number; ftl: number }
  | { ok: false; reason: string };

// A blueprint test flight keeps one mission id and replaces the plan object
// on every submit. Selecting the origin alone also submits, against whatever
// destination is still on screen, so a new object is not enough: the plan's
// endpoints have to be the leg that was asked for.
export function summarizeFreshPlan(
  plan: PrunApi.FlightPlan | undefined,
  previous: PrunApi.FlightPlan | undefined,
  originQuery: string,
  destinationQuery: string,
): Extract<BtfSummary, { ok: true }> | undefined {
  if (plan === undefined || plan === previous || plan.status !== 'OK') {
    return undefined;
  }
  if (!planMatchesLeg(plan, originQuery, destinationQuery)) {
    return undefined;
  }
  if (plan.stlFuelConsumption === null || plan.ftlFuelConsumption === null) {
    return undefined;
  }
  const seconds = Math.round(plan.eta.millis / 1000);
  return {
    ok: true,
    duration: formatDuration(seconds),
    seconds,
    stl: plan.stlFuelConsumption,
    ftl: plan.ftlFuelConsumption,
  };
}

export function planMatchesLeg(
  plan: PrunApi.FlightPlan,
  originQuery: string,
  destinationQuery: string,
) {
  const first = plan.segments[0];
  const last = plan.segments[plan.segments.length - 1];
  if (first === undefined || last === undefined) {
    return false;
  }
  return (
    sameNaturalId(getEntityNaturalIdFromAddress(first.origin), originQuery) &&
    sameNaturalId(getEntityNaturalIdFromAddress(last.destination), destinationQuery)
  );
}

export function flightPlanFailure(
  plan: PrunApi.FlightPlan | undefined,
  originQuery: string,
  destinationQuery: string,
) {
  if (
    plan !== undefined &&
    plan.status === 'OK' &&
    planMatchesLeg(plan, originQuery, destinationQuery) &&
    (plan.stlFuelConsumption === null || plan.ftlFuelConsumption === null)
  ) {
    return 'no fuel figures';
  }
  return 'no flight plan';
}

function sameNaturalId(actual: string | undefined, expected: string) {
  return actual !== undefined && actual.toUpperCase() === expected.toUpperCase();
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(' ');
}
