// Same dot colors the base game FLT Route column uses.
// Orange #f0ad4e: a ship blocked on a route step (ROUTETRACK "Blocked: LOAD at KI-840c"),
// observed live 2026-11-19. Green #5cb85c: a ship flying its route.
// Red #d9534f: the game's danger red (same as its rgba(217, 83, 79) fills), shown for a
// route in the BLOCKED execution state, observed live 2026-11-20.
export const FLT_ROUTE_BLOCKED_COLOR = '#f0ad4e';
export const FLT_ROUTE_ACTIVE_COLOR = '#5cb85c';
export const FLT_ROUTE_FAILED_COLOR = '#d9534f';

export function getFltRouteIndicatorColor(
  state: PrunApi.ShipRouteExecutionState | undefined,
): string | undefined {
  if (state === undefined) {
    return undefined;
  }
  if (state === 'BLOCKED') {
    return FLT_ROUTE_FAILED_COLOR;
  }
  return state === 'STEP_BLOCKED' ? FLT_ROUTE_BLOCKED_COLOR : FLT_ROUTE_ACTIVE_COLOR;
}

// Same label ROUTETRACK uses: the route's natural id, then its name when it has one.
export function getFltRouteLabel(route: PrunApi.ShipRoute | undefined): string | undefined {
  if (route === undefined) {
    return undefined;
  }
  return route.name ? `${route.naturalId} ${route.name}` : route.naturalId;
}
