import { addMaterials } from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import { departureBill, planOriginSegments } from '@src/features/XIT/ROUTE/route-load';
import {
  fuelCargoLoads,
  paddedLegSeconds,
  planSegmentTanks,
  routeSupplyDays,
  waitSeconds,
} from '@src/features/XIT/ROUTE/route-calc';
import { originVisitIndexes } from '@src/features/XIT/ROUTE/route-stops';
import { configLegSeconds, matchConfigRoute, routeEta } from '@src/features/XIT/ROUTE/route-eta';
import {
  countdownDays,
  daysToMs,
  drawTotal,
  firstShortDraw,
  lapMs,
  lapStarts,
  loadingAtOrigin,
  nextLapStart,
  unassignedCxLoads,
  type OriginDraw,
} from '@src/features/XIT/ROUTE/route-supply';
import {
  cargoForRouteShip,
  fuelCapacities,
  shipForRoute,
} from '@src/features/XIT/ROUTE/owned-ship';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { userData } from '@src/store/user-data';

// The countdown looks this far ahead at least. Past it, the origin reads as covered.
const MIN_HORIZON_DAYS = 30;

export interface OriginRow {
  key: string;
  kind: 'cx' | 'base';
  id: string;
  label: string;
  // Saved routes that start here, and how many of them have a ship running them.
  routes: number;
  running: number;
  // Days to the first lap the store cannot load. Undefined when covered up to horizonDays.
  countdown: number | undefined;
  horizonDays: number;
  // A running route's lap could not be priced or timed, so the countdown may be late.
  partial: boolean;
  // Everything the laps within the resupply days load here, before stock.
  restock: Record<string, number>;
  // Every running lap's load here, up to horizonDays.
  draws: OriginDraw[];
}

// A saved stop's location id: an exchange's station (ANT), a base's planet (ZV-759c).
export function stopLocationId(stop: UserData.ShippingRouteStop) {
  return stop.kind === 'cx' ? (exchangesStore.getNaturalIdFromCode(stop.id) ?? stop.id) : stop.id;
}

function originLabel(stop: UserData.ShippingRouteStop) {
  if (stop.kind === 'cx') {
    return exchangesStore.getNaturalIdFromCode(stop.id) ?? stop.id;
  }
  const site = sitesStore.getByPlanetNaturalId(stop.id);
  return site === undefined ? stop.id : (getEntityNameFromAddress(site.address) ?? stop.id);
}

// What one lap takes out of the origin store: the departure load ROUTECONFIG
// plans for the RT, plus, on a loop, refilling the tanks that lap burned. Same
// inputs as ROUTECONFIG. Undefined when ROUTECONFIG could not plan the load either.
export function originLapNeed(route: UserData.ShippingRoute) {
  const hold = cargoForRouteShip(route);
  if (hold === undefined) {
    return undefined;
  }
  const padded =
    sumBy(paddedLegSeconds(route.legs ?? []), seconds => seconds) + waitSeconds(route.wait);
  const days = routeSupplyDays(route.days, padded);
  const caps = fuelCapacities(shipForRoute(route));
  const origins = originVisitIndexes(route.stops);
  const tanks = planSegmentTanks(caps.stl, caps.ftl, route.legs ?? [], origins);
  const fuel = fuelCargoLoads(tanks.stl, tanks.ftl, origins.length > 0 ? origins : [0]);
  const segments = planOriginSegments(route.stops, days, fuel, hold, route.loop);
  if (segments === undefined || segments.length === 0) {
    return undefined;
  }
  const first = segments[0];
  if (first === undefined) {
    return undefined;
  }
  let need = departureBill(first.bases, first.plan.sourced, first.plan.departureExtra);
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === undefined) {
      continue;
    }
    need = addMaterials(
      need,
      departureBill(segment.bases, segment.plan.sourced, segment.plan.departureExtra),
    );
  }
  if (route.loop !== false) {
    let stl = caps.stl - (tanks.stl.at(-1)?.level ?? caps.stl);
    let ftl = caps.ftl - (tanks.ftl.at(-1)?.level ?? caps.ftl);
    if (tanks.arrivals.length > 1) {
      stl = 0;
      ftl = 0;
      for (const arrival of tanks.arrivals) {
        stl += caps.stl - arrival.stl;
        ftl += caps.ftl - arrival.ftl;
      }
    }
    if (stl > 0) {
      need.SF = (need.SF ?? 0) + Math.ceil(stl);
    }
    if (ftl > 0) {
      need.FF = (need.FF ?? 0) + Math.ceil(ftl);
    }
  }
  return need;
}

export function originStoreStock(stop: UserData.ShippingRouteStop) {
  let store: PrunApi.Store | undefined;
  if (stop.kind === 'cx') {
    const warehouse = warehousesStore.getByEntityNaturalId(
      exchangesStore.getNaturalIdFromCode(stop.id),
    );
    store = storagesStore.getById(warehouse?.storeId);
  } else {
    const site = sitesStore.getByPlanetNaturalId(stop.id);
    store = (site === undefined ? undefined : storagesStore.getByAddressableId(site.siteId))?.find(
      x => x.type === 'STORE',
    );
  }
  const stock: Record<string, number> = {};
  for (const item of store?.items ?? []) {
    const quantity = item.quantity;
    if (quantity) {
      stock[quantity.material.ticker] = (stock[quantity.material.ticker] ?? 0) + quantity.amount;
    }
  }
  return stock;
}

interface Running {
  route: UserData.ShippingRoute;
  laps: number[];
  partial: boolean;
}

function runningRoutes(now: number, until: number) {
  const running: Running[] = [];
  for (const execution of shipRoutesStore.all.value) {
    const ship = shipsStore.getById(execution.shipId);
    const waypoints = execution.route.waypoints;
    const waypointIds = waypoints.map(x => getEntityNaturalIdFromAddress(x.destination));
    const saved = matchConfigRoute(
      waypointIds,
      ship?.registration,
      userData.routes,
      stopLocationId,
    );
    if (saved === undefined) {
      continue;
    }
    const currentId = waypointIds[execution.waypointIndex];
    const atWaypoint =
      ship !== undefined &&
      !ship.flightId &&
      currentId !== undefined &&
      getEntityNaturalIdFromAddress(ship.address ?? undefined) === currentId;
    const legSeconds = configLegSeconds(saved, execution.route.repeats);
    const eta = routeEta({
      execution,
      now,
      flightArrival: flightsStore.getById(execution.flightId)?.arrival.timestamp,
      atWaypoint,
      legSeconds,
    });
    const lap = lapMs(waypoints, legSeconds);
    const next = nextLapStart(execution, eta, legSeconds);
    running.push({
      route: saved,
      laps: lapStarts({
        now,
        until,
        loadingNow: loadingAtOrigin(execution, atWaypoint),
        repeats: execution.route.repeats,
        nextLap: next.time,
        lapMs: lap,
      }),
      partial: next.partial || (execution.route.repeats && lap === undefined),
    });
  }
  return running;
}

export function originRows(now: number): OriginRow[] {
  const settings = userData.settings.routeSupply;
  const horizonDays = Math.max(MIN_HORIZON_DAYS, settings.days * 2, settings.yellow);
  const until = now + daysToMs(horizonDays);
  const restockUntil = now + daysToMs(settings.days);
  const running = runningRoutes(now, until);

  const rows = new Map<string, OriginRow & { stop: UserData.ShippingRouteStop }>();
  for (const route of userData.routes) {
    const stop = route.stops[0];
    if (stop === undefined) {
      continue;
    }
    const key = `${stop.kind}:${stop.id}`;
    let row = rows.get(key);
    if (row === undefined) {
      row = {
        key,
        kind: stop.kind,
        id: stop.id,
        label: originLabel(stop),
        routes: 0,
        running: 0,
        countdown: undefined,
        horizonDays,
        partial: false,
        restock: {},
        draws: [],
        stop,
      };
      rows.set(key, row);
    }
    row.routes++;
    const mine = running.filter(x => x.route === route);
    if (mine.length === 0) {
      const plan = unassignedCxLoads({
        now,
        until,
        looping: route.loop !== false,
        cx: stop.kind === 'cx',
        need: stop.kind === 'cx' ? originLapNeed(route) : undefined,
        legSeconds: configLegSeconds(route, true),
      });
      row.partial ||= plan.partial;
      row.draws.push(...plan.draws);
      continue;
    }
    row.running += mine.length;
    const need = originLapNeed(route);
    if (need === undefined) {
      row.partial = true;
      continue;
    }
    for (const run of mine) {
      row.partial ||= run.partial;
      for (const time of run.laps) {
        row.draws.push({ time, need });
      }
    }
  }

  return [...rows.values()].map(({ stop, ...row }) => ({
    ...row,
    countdown: countdownDays(now, firstShortDraw(row.draws, originStoreStock(stop))),
    restock: drawTotal(row.draws, restockUntil),
  }));
}
