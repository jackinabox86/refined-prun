import { originRows } from '@src/features/XIT/ROUTE/route-origins';
import { restockWindowEnd } from '@src/features/XIT/ROUTE/route-reserve';
import { drawTotal } from '@src/features/XIT/ROUTE/route-supply';
import { userData } from '@src/store/user-data';

// Per exchange code, what the running routes load there between now and the end
// of the window its last Route Restock run opened. An exchange never restocked,
// or whose window has run out, holds nothing.
export function cxRouteReserve(now: number) {
  const { days, restockedAt } = userData.settings.routeSupply;
  const reserve: Record<string, Record<string, number>> = {};
  for (const row of originRows(now)) {
    if (row.kind !== 'cx') {
      continue;
    }
    const end = restockWindowEnd(restockedAt[row.id], days, now);
    if (end === undefined) {
      continue;
    }
    const held = drawTotal(row.draws, end);
    if (Object.keys(held).length > 0) {
      reserve[row.id] = held;
    }
  }
  return reserve;
}

// Starts a fresh window at every exchange a Route Restock run bought for.
export function markRestocked(exchanges: readonly string[], now: number) {
  for (const exchange of exchanges) {
    userData.settings.routeSupply.restockedAt[exchange] = now;
  }
}
