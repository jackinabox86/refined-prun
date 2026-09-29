export type BtfSummary =
  | { ok: true; duration: string; seconds: number; stl: number; ftl: number }
  | { ok: false; reason: string };

// A blueprint test flight keeps one mission id and replaces the plan object
// on every submit, including a repeat of the same route. The previous object
// is the plan already on screen, so it is not a result.
export function summarizeFreshPlan(
  plan: PrunApi.FlightPlan | undefined,
  previous: PrunApi.FlightPlan | undefined,
): Extract<BtfSummary, { ok: true }> | undefined {
  if (plan === undefined || plan === previous || plan.status !== 'OK') {
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

export function flightPlanFailure(plan: PrunApi.FlightPlan | undefined) {
  if (
    plan !== undefined &&
    plan.status === 'OK' &&
    (plan.stlFuelConsumption === null || plan.ftlFuelConsumption === null)
  ) {
    return 'no fuel figures';
  }
  return 'no flight plan';
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
