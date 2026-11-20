// Same dot colors the base game FLT Route column uses. Observed live 2026-11-19:
// a ship blocked on a route step (ROUTETRACK "Blocked: LOAD at KI-840c") showed
// #f0ad4e, a ship flying its route showed #5cb85c.
export const FLT_ROUTE_BLOCKED_COLOR = '#f0ad4e';
export const FLT_ROUTE_ACTIVE_COLOR = '#5cb85c';

export function getFltRouteIndicatorColor(
  state: PrunApi.ShipRouteExecutionState | undefined,
): string | undefined {
  if (state === undefined) {
    return undefined;
  }
  return state === 'STEP_BLOCKED' ? FLT_ROUTE_BLOCKED_COLOR : FLT_ROUTE_ACTIVE_COLOR;
}
