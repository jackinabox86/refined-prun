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

export function saveRouteLegs(
  routeId: string | undefined,
  legs: readonly {
    ok: boolean;
    seconds?: number;
    stl?: number;
    ftl?: number;
    gateway?: boolean;
  }[],
) {
  const route = findRoute(routeId);
  if (route === undefined) {
    return;
  }
  route.legs = legs.map(x => ({
    ok: x.ok,
    seconds: x.seconds,
    stl: x.stl,
    ftl: x.ftl,
    gateway: x.gateway,
  }));
}
