import type { ActionStep } from '@src/features/XIT/ACT/shared-types';
import { RT_ASSIGN } from '@src/features/XIT/ROUTE/RT_ASSIGN';
import { cxRouteReserve } from '@src/features/XIT/ROUTE/cx-route-reserve';
import {
  assignShortfall,
  gameRouteIdFor,
  shortfallMaterials,
  type AssignStockLine,
  type GameRouteRef,
} from '@src/features/XIT/ROUTE/route-assign';
import { routeAssignPackage } from '@src/features/XIT/ROUTE/route-assign-package';
import {
  originLapNeed,
  originStoreStock,
  stopLocationId,
} from '@src/features/XIT/ROUTE/route-origins';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';

export interface StagedRouteAssign {
  pkg: UserData.ActionPackageData;
  steps: ActionStep[];
  shortLines?: AssignStockLine[];
  originLabel?: string;
}

export const stagedRouteAssign = ref<StagedRouteAssign | undefined>(undefined);

export function gameRoutesNow(): GameRouteRef[] {
  return shipRoutesStore.all.value.map(execution => ({
    naturalId: execution.route.naturalId,
    repeats: execution.route.repeats,
    waypointIds: execution.route.waypoints.map(waypoint =>
      getEntityNaturalIdFromAddress(waypoint.destination),
    ),
  }));
}

const NO_RT = 'Build this route from ROUTECONFIG before assigning a ship.';
const NO_LOAD = "ROUTECONFIG could not plan this route's load.";

export function assignReadiness(route: UserData.ShippingRoute) {
  if (route.loop !== false) {
    return { show: false, enabled: false, tip: '' };
  }
  if (gameRouteIdFor(route, gameRoutesNow(), stopLocationId) === undefined) {
    return { show: true, enabled: false, tip: NO_RT };
  }
  if (originLapNeed(route) === undefined) {
    return { show: true, enabled: false, tip: NO_LOAD };
  }
  return { show: true, enabled: true, tip: '' };
}

// Stages the buy (CX only) and the assign step. A short base is listed and not assigned.
export function stageRouteAssign(route: UserData.ShippingRoute, now: number, originLabel: string) {
  const rtId = gameRouteIdFor(route, gameRoutesNow(), stopLocationId);
  const stop = route.stops[0];
  const need = originLapNeed(route);
  if (rtId === undefined || stop === undefined || need === undefined) {
    stagedRouteAssign.value = undefined;
    return false;
  }
  const reserve = stop.kind === 'cx' ? cxRouteReserve(now)[stop.id] : undefined;
  const lines = assignShortfall(need, originStoreStock(stop), reserve);
  const short = shortfallMaterials(lines);
  if (Object.keys(short).length > 0 && stop.kind !== 'cx') {
    stagedRouteAssign.value = {
      pkg: routeAssignPackage(undefined, {}),
      steps: [],
      shortLines: lines.filter(x => x.short > 0),
      originLabel,
    };
    return true;
  }
  const exchange = stop.kind === 'cx' ? stop.id : undefined;
  stagedRouteAssign.value = {
    pkg: routeAssignPackage(exchange, short),
    steps: [RT_ASSIGN({ routeId: rtId, ship: route.ship?.trim() ?? '', need })],
  };
  return true;
}
