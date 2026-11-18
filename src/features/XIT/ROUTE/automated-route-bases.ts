import { gameRouteIdFor } from '@src/features/XIT/ROUTE/route-assign';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';
import { userData } from '@src/store/user-data';

// Font Awesome solid rocket (U+F135). Same glyph upstream uses in XIT BURN for
// inbound cargo.
export const EN_ROUTE_ROCKET = '\uf135';

// Blue used for the inv-item rocket marker and the en-route burn cell.
export const EN_ROUTE_BLUE = '#088DBF';
export const EN_ROUTE_BLUE_BG = 'rgba(8, 141, 191, 0.35)';

// Base planets of every looping ROUTECONFIG route whose game route a ship is
// running right now without interruption. The game route is the one stored on the
// saved route, or else the only execution with the same stops (gameRouteIdFor).
// A game route made outside ROUTECONFIG, a one-way route, a route no ship runs and
// a route blocked on a step do not count.
export function runningRouteStops(
  executions: readonly PrunApi.ShipRouteExecution[],
  routes: readonly UserData.ShippingRoute[],
  waypointId: (waypoint: PrunApi.ShipRouteWaypoint) => string | undefined,
  resolveStop: (stop: UserData.ShippingRouteStop) => string | undefined,
) {
  const games = executions.map(execution => ({
    naturalId: execution.route.naturalId,
    repeats: execution.route.repeats,
    waypointIds: execution.route.waypoints.map(waypointId),
  }));
  const running = new Set(
    executions
      .filter(x => x.route.repeats && x.state !== 'STEP_BLOCKED')
      .map(x => x.route.naturalId),
  );
  const ids = new Set<string>();
  for (const route of routes) {
    if (route.loop === false) {
      continue;
    }
    const rtId = gameRouteIdFor(route, games, resolveStop);
    if (rtId === undefined || !running.has(rtId)) {
      continue;
    }
    for (const stop of route.stops) {
      if (stop.kind === 'base') {
        ids.add(stop.id);
      }
    }
  }
  return ids;
}

const runningStops = computed(() =>
  runningRouteStops(
    shipRoutesStore.all.value,
    userData.routes,
    x => getEntityNaturalIdFromAddress(x.destination),
    stop =>
      stop.kind === 'cx' ? (exchangesStore.getNaturalIdFromCode(stop.id) ?? stop.id) : stop.id,
  ),
);

// A base planet a ship is serving on a running looping ROUTECONFIG route.
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
