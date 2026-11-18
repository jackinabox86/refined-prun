import { FUEL_BUFFER } from '@src/features/XIT/ROUTE/route-supply';
import { displaytimeBetween, fixed0, percent0 } from '@src/utils/format';

// CX stock held back for the routes. A Route Restock run opens a window of
// resupply days at each exchange it bought for, and every lap a running route
// loads there before the window ends is a floor the other ACT buys (BURN,
// REPAIR, GOVBURN, DISPATCH, custom packages) may not draw below. Laps that have
// already loaded drop out, so the floor shrinks as routes cycle and other buys
// never top it back up.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RouteReserveShare {
  name: string;
  departures: number;
  // Average time between departures. Undefined with a single departure.
  spacingMs: number | undefined;
  // No ship runs the route, so its departures are planned from now.
  planned: boolean;
  held: Record<string, number>;
}

// Why the routes hold `ticker` here: each route's departures before the
// restock window ends, how often it departs, and what each departure loads.
export function describeRouteReserve(
  ticker: string,
  shares: readonly RouteReserveShare[],
  now: number,
  end: number,
) {
  const lines = [
    `Held for route departures in the next ${displaytimeBetween(now, end)}, ` +
      'until the restock window ends (Restock days in XIT SET ROUTE, from the last Route Restock).',
  ];
  for (const share of shares) {
    const amount = share.held[ticker] ?? 0;
    if (!(amount > 0)) {
      continue;
    }
    let departures = `${share.departures} departure${share.departures === 1 ? '' : 's'}`;
    if (share.spacingMs !== undefined) {
      departures += `, one every ${displaytimeBetween(0, share.spacingMs)}`;
    }
    const each = share.departures > 1 ? ` (~${fixed0(amount / share.departures)} each)` : '';
    const planned = share.planned ? ' No ship runs it, so it is planned from now.' : '';
    lines.push(`${share.name}: ${departures}, ${fixed0(amount)} ${ticker}${each}.${planned}`);
  }
  if (ticker === 'SF' || ticker === 'FF') {
    lines.push(`Fuel includes a ${percent0(FUEL_BUFFER - 1)} buffer.`);
  }
  return lines.join('\n');
}

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
