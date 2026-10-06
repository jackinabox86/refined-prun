// CX stock held back for the routes. A Route Restock run opens a window of
// resupply days at each exchange it bought for, and every lap a running route
// loads there before the window ends is a floor the other ACT buys (BURN,
// REPAIR, GOVBURN, DISPATCH, custom packages) may not draw below. Laps that have
// already loaded drop out, so the floor shrinks as routes cycle and other buys
// never top it back up.

const DAY_MS = 24 * 60 * 60 * 1000;

// When the window the last restock opened ends. Undefined when the exchange was
// never restocked or its window has run out.
export function restockWindowEnd(restockedAt: number | undefined, days: number, now: number) {
  if (restockedAt === undefined) {
    return undefined;
  }
  const end = restockedAt + days * DAY_MS;
  return end > now ? end : undefined;
}

export function withoutReserve(
  stock: Readonly<Record<string, number>>,
  reserve: Readonly<Record<string, number>> | undefined,
) {
  const left: Record<string, number> = {};
  for (const [ticker, amount] of Object.entries(stock)) {
    const free = amount - (reserve?.[ticker] ?? 0);
    if (free > 0) {
      left[ticker] = free;
    }
  }
  return left;
}

// What the reserve actually holds out of the stock: the reserve, capped by what is there.
export function heldStock(
  stock: Readonly<Record<string, number>>,
  reserve: Readonly<Record<string, number>> | undefined,
) {
  const held: Record<string, number> = {};
  for (const [ticker, amount] of Object.entries(reserve ?? {})) {
    const take = Math.min(amount, stock[ticker] ?? 0);
    if (take > 0) {
      held[ticker] = take;
    }
  }
  return held;
}

export interface RouteStockDraw {
  ticker: string;
  held: number;
  left: number;
}

// The tickers where taking `take` out of `stock` leaves less than the reserve.
// Stock already under the reserve warns on any take, since it only goes lower.
export function routeStockDraws(
  stock: Readonly<Record<string, number>>,
  take: Readonly<Record<string, number>>,
  reserve: Readonly<Record<string, number>>,
) {
  const draws: RouteStockDraw[] = [];
  for (const [ticker, amount] of Object.entries(take)) {
    const held = reserve[ticker] ?? 0;
    if (!(amount > 0) || !(held > 0)) {
      continue;
    }
    const left = (stock[ticker] ?? 0) - amount;
    if (left < held) {
      draws.push({ ticker, held, left: Math.max(0, left) });
    }
  }
  return draws;
}

// The live reserve, lowered to what it held when the package was generated.
export function floorReserve(
  live: Readonly<Record<string, number>>,
  atStart: Readonly<Record<string, number>> | undefined,
) {
  if (atStart === undefined) {
    return { ...live };
  }
  const floor: Record<string, number> = {};
  for (const [ticker, amount] of Object.entries(live)) {
    floor[ticker] = Math.min(amount, atStart[ticker] ?? 0);
  }
  return floor;
}
