import type { ActionStep } from '@src/features/XIT/ACT/shared-types';
import { RT_ASSIGN } from '@src/features/XIT/ROUTE/RT_ASSIGN';
import { cargoForRouteShip } from '@src/features/XIT/ROUTE/owned-ship';
import { beginShipPick } from '@src/features/XIT/ROUTE/route-ship-pick';
import { shipOptions } from '@src/features/XIT/TRANSITS/ship-options';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { cxRouteReserve } from '@src/features/XIT/ROUTE/cx-route-reserve';
import {
  assignShortfall,
  cargoFits,
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
const PICK_SHIP = "ASSIGN asks for a ship that can carry this route's load.";

function hasShip(route: UserData.ShippingRoute) {
  return (route.ship?.trim().length ?? 0) > 0;
}

export function assignReadiness(route: UserData.ShippingRoute) {
  if (route.loop !== false) {
    return { show: false, enabled: false, tip: '' };
  }
  if (gameRouteIdFor(route, gameRoutesNow(), stopLocationId) === undefined) {
    return { show: true, enabled: false, tip: NO_RT };
  }
  // No ship yet: ASSIGN asks for one before ROUTEBUY.
  if (!hasShip(route)) {
    return { show: true, enabled: true, tip: PICK_SHIP };
  }
  if (originLapNeed(route) === undefined) {
    return { show: true, enabled: false, tip: NO_LOAD };
  }
  return { show: true, enabled: true, tip: '' };
}

// Owned ships whose hold carries the load this route plans with that ship.
export function shipsThatFit(route: UserData.ShippingRoute) {
  const fits: { value: string; label: string }[] = [];
  for (const option of shipOptions()) {
    const trial = { ...route, ship: option.value };
    const need = originLapNeed(trial);
    const hold = cargoForRouteShip(trial);
    if (need === undefined || hold === undefined) {
      continue;
    }
    const specs: Record<string, { weight: number; volume: number } | undefined> = {};
    for (const ticker of Object.keys(need)) {
      const mat = materialsStore.getByTicker(ticker);
      specs[ticker] = mat === undefined ? undefined : { weight: mat.weight, volume: mat.volume };
    }
    if (cargoFits(need, specs, hold)) {
      const label = option.label.endsWith(` (${option.value})`)
        ? option.label.slice(0, -(option.value.length + 3))
        : option.label;
      fits.push({ value: option.value, label });
    }
  }
  return fits;
}

// A route with no ship gets one first: the pick is saved on the route, so the
// buy and the assign are sized for that ship. False when nothing was picked.
export async function ensureRouteShip(route: UserData.ShippingRoute) {
  if (hasShip(route)) {
    return true;
  }
  const fits = shipsThatFit(route);
  const picked = await beginShipPick(
    fits.map(x => ({ label: x.label })),
    `${route.name} has no ship. Pick one that can carry its load.`,
  );
  const ship = fits.find(x => x.label === picked);
  if (ship === undefined) {
    return false;
  }
  route.ship = ship.value;
  return true;
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
