import { originRows } from '@src/features/XIT/ROUTE/route-origins';
import { restockWindowEnd, type RouteReserveShare } from '@src/features/XIT/ROUTE/route-reserve';
import { drawsByRoute, drawTotal } from '@src/features/XIT/ROUTE/route-supply';
import { findRoute } from '@src/features/XIT/ROUTE/routes';
import { userData } from '@src/store/user-data';

// Per exchange code, what the running routes load there between now and the end
// of the window its last Route Restock run opened, and which routes load it.
// An exchange never restocked, or whose window has run out, holds nothing.
export function cxRouteReserveDetail(now: number) {
  const { days, restockedAt } = userData.settings.routeSupply;
  const detail: Record<
    string,
    { end: number; held: Record<string, number>; routes: RouteReserveShare[] }
  > = {};
  for (const row of originRows(now)) {
    if (row.kind !== 'cx') {
      continue;
    }
    const end = restockWindowEnd(restockedAt[row.id], days, now);
    if (end === undefined) {
      continue;
    }
    const held = drawTotal(row.draws, end);
    if (Object.keys(held).length === 0) {
      continue;
    }
    const routes = drawsByRoute(row.draws, end).map(share => ({
      name: findRoute(share.route)?.name ?? share.route,
      departures: share.departures,
      spacingMs: share.spacingMs,
      planned: share.planned,
      held: share.total,
    }));
    detail[row.id] = { end, held, routes };
  }
  return detail;
}

export function cxRouteReserve(now: number) {
  const reserve: Record<string, Record<string, number>> = {};
  for (const [exchange, detail] of Object.entries(cxRouteReserveDetail(now))) {
    reserve[exchange] = detail.held;
  }
  return reserve;
}

// Starts a fresh window at every exchange a Route Restock run bought for.
export function markRestocked(exchanges: readonly string[], now: number) {
  for (const exchange of exchanges) {
    userData.settings.routeSupply.restockedAt[exchange] = now;
  }
}
