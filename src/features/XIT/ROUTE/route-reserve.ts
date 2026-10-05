// CX stock held back for the routes. Every lap a running route loads at an
// exchange origin within the resupply days is a floor the other ACT buys
// (BURN, REPAIR, GOVBURN, DISPATCH, custom packages) may not draw below. The
// window rolls with the clock and laps that have already loaded drop out, so
// the floor shrinks as routes cycle and other buys never top it back up.
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
