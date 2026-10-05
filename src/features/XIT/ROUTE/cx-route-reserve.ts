import { originRows } from '@src/features/XIT/ROUTE/route-origins';

// Per exchange code, what the running routes load there within the resupply days.
export function cxRouteReserve(now: number) {
  const reserve: Record<string, Record<string, number>> = {};
  for (const row of originRows(now)) {
    if (row.kind === 'cx' && Object.keys(row.restock).length > 0) {
      reserve[row.id] = row.restock;
    }
  }
  return reserve;
}
