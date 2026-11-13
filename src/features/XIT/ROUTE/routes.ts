import { transitStopIds } from '@src/features/XIT/ROUTE/route-calc';
import { userData } from '@src/store/user-data';

export const ROUTE_STOP_MIME = 'application/x-rpr-route-stop';

export function shippingRoutes() {
  return userData.routes;
}

export function findRoute(id: string | undefined) {
  if (id === undefined) {
    return undefined;
  }
  return userData.routes.find(x => x.id === id);
}

export function createRoute() {
  const route: UserData.ShippingRoute = {
    id: crypto.randomUUID(),
    name: `Route ${userData.routes.length + 1}`,
    stops: [],
  };
  userData.routes.push(route);
  return route;
}

export function removeRoute(id: string) {
  const index = userData.routes.findIndex(x => x.id === id);
  if (index < 0) {
    return;
  }
  userData.routes.splice(index, 1);
}

export function saveRouteRtId(configRouteId: string | undefined, rtId: string) {
  const id = configRouteId?.trim() ?? '';
  const gameId = rtId.trim();
  if (id.length === 0 || gameId.length === 0) {
    return;
  }
  const route = findRoute(id);
  if (route === undefined) {
    return;
  }
  route.rtId = gameId;
  route.legsAfterRt = undefined;
}

// Leg i belongs to the waypoint after stop i, so legs flown over other stops than
// the route's current ones would land on the wrong waypoints. Returns false then.
export function saveRouteLegs(
  routeId: string | undefined,
  stops: readonly string[],
  legs: readonly {
    ok: boolean;
    seconds?: number;
    stl?: number;
    ftl?: number;
    gateway?: boolean;
    fuelUsage?: number;
    reactorUsage?: number;
  }[],
) {
  const route = findRoute(routeId);
  if (route === undefined) {
    return true;
  }
  const current = transitStopIds(route.stops, route.loop);
  if (current.length !== stops.length || current.some((id, i) => id !== stops[i])) {
    return false;
  }
  if (route.rtId !== undefined) {
    route.legsAfterRt = true;
  }
  route.legs = legs.map(x => ({
    ok: x.ok,
    seconds: x.seconds,
    stl: x.stl,
    ftl: x.ftl,
    gateway: x.gateway,
    fuelUsage: x.fuelUsage,
    reactorUsage: x.reactorUsage,
  }));
  return true;
}

export function addImportedRoute(imported: Omit<UserData.ShippingRoute, 'id'>) {
  const route: UserData.ShippingRoute = { ...imported, id: crypto.randomUUID() };
  userData.routes.push(route);
  return route;
}
