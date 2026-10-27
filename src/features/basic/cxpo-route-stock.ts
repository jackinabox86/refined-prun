import { routeStockDraws } from '@src/features/XIT/ROUTE/route-reserve';

// The CXPO inventory row, when the CX warehouse is selected and a route reserve
// exists: `(r Reserved) f Free`. Undefined leaves the game's own number.
export function cxpoInventoryLabel(stock: number, reserve: number | undefined) {
  if (reserve === undefined || !(reserve > 0)) {
    return undefined;
  }
  const free = Math.max(0, stock - reserve);
  return `(${Math.trunc(reserve)} Reserved) ${Math.trunc(free)} Free`;
}

export function isCxpoInventoryLabel(text: string) {
  return /^\(\d+ Reserved\) \d+ Free$/.test(text.trim());
}

// Same draw rule as routeStockShortfall: a positive sell holds when it would
// leave this ticker below the reserve. Stock already under the reserve holds
// on any positive amount.
export function cxpoSellHitsReserve(stock: number, amount: number, reserve: number | undefined) {
  return routeStockDraws({ MAT: stock }, { MAT: amount }, { MAT: reserve ?? 0 }).length > 0;
}
