import { matchConfigRoute } from '@src/features/XIT/ROUTE/route-eta';

// A saved route loops unless ROUTECONFIG turned the loop off.
export function splitRouteSections<T extends { loop?: boolean }>(routes: readonly T[]) {
  const nonLooping: T[] = [];
  const looping: T[] = [];
  for (const route of routes) {
    if (route.loop === false) {
      nonLooping.push(route);
    } else {
      looping.push(route);
    }
  }
  return { nonLooping, looping };
}

export interface AssignStockLine {
  ticker: string;
  need: number;
  free: number;
  short: number;
}

// What the departure bill still needs after the loop reserve is left in the store.
// Free stock is warehouse minus reserve, and it is never negative.
export function assignShortfall(
  need: Readonly<Record<string, number>>,
  stock: Readonly<Record<string, number>>,
  reserve: Readonly<Record<string, number>> | undefined,
): AssignStockLine[] {
  const lines: AssignStockLine[] = [];
  for (const [ticker, amount] of Object.entries(need)) {
    if (!(amount > 0)) {
      continue;
    }
    const free = Math.max(0, (stock[ticker] ?? 0) - (reserve?.[ticker] ?? 0));
    const gap = amount - free;
    lines.push({
      ticker,
      need: amount,
      free,
      short: gap > 0 ? Math.ceil(gap) : 0,
    });
  }
  lines.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return lines;
}

export function shortfallMaterials(lines: readonly AssignStockLine[]) {
  const materials: Record<string, number> = {};
  for (const line of lines) {
    if (line.short > 0) {
      materials[line.ticker] = line.short;
    }
  }
  return materials;
}

export interface GameRouteRef {
  naturalId: string;
  repeats: boolean;
  waypointIds: readonly (string | undefined)[];
}

// The stored game id wins. Otherwise exactly one execution with the same stops
// and the same loop flag. A route that was built and never assigned has neither.
export function gameRouteIdFor(
  route: UserData.ShippingRoute,
  games: readonly GameRouteRef[],
  resolveStop: (stop: UserData.ShippingRouteStop) => string | undefined,
) {
  const stored = route.rtId?.trim() ?? '';
  if (stored.length > 0) {
    return stored;
  }
  const looping = route.loop !== false;
  const hits = games.filter(game => {
    if (game.repeats !== looping) {
      return false;
    }
    return matchConfigRoute(game.waypointIds, undefined, [route], resolveStop) !== undefined;
  });
  if (hits.length !== 1) {
    return undefined;
  }
  return hits[0]?.naturalId;
}

export function cargoFits(
  need: Readonly<Record<string, number>>,
  specs: Readonly<Record<string, { weight: number; volume: number } | undefined>>,
  hold: { weightCapacity: number; volumeCapacity: number },
) {
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(need)) {
    if (!(amount > 0)) {
      continue;
    }
    const spec = specs[ticker];
    if (spec === undefined) {
      return false;
    }
    weight += amount * spec.weight;
    volume += amount * spec.volume;
  }
  return weight <= hold.weightCapacity && volume <= hold.volumeCapacity;
}
