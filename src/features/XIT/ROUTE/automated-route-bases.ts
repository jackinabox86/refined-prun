import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';

// Font Awesome solid rocket (U+F135). Same glyph upstream uses in XIT BURN for
// inbound cargo.
export const EN_ROUTE_ROCKET = '';

// Blue used for the inv-item rocket marker and the en-route burn cell.
export const EN_ROUTE_BLUE = '#088DBF';
export const EN_ROUTE_BLUE_BG = 'rgba(8, 141, 191, 0.35)';

// Waypoint location ids of every looping game route a ship is running right now
// without interruption. A one-way route, or one blocked on a step, does not count.
// Saved ROUTECONFIG routes alone do not count either: only a live execution does.
export function runningRouteStops(
  executions: readonly PrunApi.ShipRouteExecution[],
  waypointId: (waypoint: PrunApi.ShipRouteWaypoint) => string | undefined,
) {
  const ids = new Set<string>();
  for (const execution of executions) {
    if (!execution.route.repeats || execution.state === 'STEP_BLOCKED') {
      continue;
    }
    for (const waypoint of execution.route.waypoints) {
      const id = waypointId(waypoint);
      if (id !== undefined) {
        ids.add(id);
      }
    }
  }
  return ids;
}

const runningStops = computed(() =>
  runningRouteStops(shipRoutesStore.all.value, x => getEntityNaturalIdFromAddress(x.destination)),
);

// A base planet a ship is serving on a running looping route.
export function isOnAutomatedRoute(naturalId: string) {
  return runningStops.value.has(naturalId);
}

// Same floor as daysUntilRepairTarget === 0: age has reached the target.
export function hasRepairsDue(age: number | undefined, repairTarget: number) {
  return age !== undefined && age >= repairTarget;
}

// Push en-route bases to the bottom of a burn-oriented list. When
// `repairsDueBreaksThrough` is true (BS DYNAMIC), a base with repairs due
// keeps its normal rank instead.
export function compareEnRouteLast(
  aOnRoute: boolean,
  bOnRoute: boolean,
  options?: {
    repairsDueBreaksThrough?: boolean;
    aRepairsDue?: boolean;
    bRepairsDue?: boolean;
  },
) {
  const allow = options?.repairsDueBreaksThrough === true;
  const aLast = aOnRoute && !(allow && options?.aRepairsDue === true);
  const bLast = bOnRoute && !(allow && options?.bRepairsDue === true);
  if (aLast === bLast) {
    return 0;
  }
  return aLast ? 1 : -1;
}
