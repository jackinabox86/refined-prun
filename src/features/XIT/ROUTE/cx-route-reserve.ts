import { originRows } from '@src/features/XIT/ROUTE/route-origins';
import { reservedDraws, restockWindowEnd } from '@src/features/XIT/ROUTE/route-reserve';
import { drawTotal } from '@src/features/XIT/ROUTE/route-supply';
import { userData } from '@src/store/user-data';

// Per exchange code, what the running routes load there between now and the end
// of the window its last Route Restock run opened, plus any lap that run bought
// which leaves after the window, until it loads. An exchange never restocked,
// or whose window and waiting laps have run out, holds nothing.
export function cxRouteReserve(now: number) {
  const { days, restockedAt, waitingLaps } = userData.settings.routeSupply;
  const reserve: Record<string, Record<string, number>> = {};
  for (const row of originRows(now)) {
    if (row.kind !== 'cx') {
      continue;
    }
    const end = restockWindowEnd(restockedAt[row.id], days, now);
    const held = drawTotal(reservedDraws(row.draws, end, waitingLaps), Infinity);
    if (Object.keys(held).length > 0) {
      reserve[row.id] = held;
    }
  }
  return reserve;
}

// Starts a fresh window at every exchange a Route Restock run bought for, and
// replaces the waiting-lap holds of the routes that start there.
export function markRestocked(
  exchanges: readonly string[],
  now: number,
  waiting: Readonly<Record<string, number>>,
) {
  const settings = userData.settings.routeSupply;
  for (const exchange of exchanges) {
    settings.restockedAt[exchange] = now;
  }
  for (const route of userData.routes) {
    const stop = route.stops[0];
    if (stop?.kind === 'cx' && exchanges.includes(stop.id)) {
      delete settings.waitingLaps[route.id];
    }
  }
  for (const [id, hold] of Object.entries(settings.waitingLaps)) {
    if (!(hold > now)) {
      delete settings.waitingLaps[id];
    }
  }
  Object.assign(settings.waitingLaps, waiting);
}
