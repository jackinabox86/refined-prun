const MS_IN_DAY = 24 * 60 * 60 * 1000;

// Days from `now` until the first consumption tick this material cannot pay.
export function materialDays(upkeep: UserData.GovBurnUpkeep, now: number) {
  const ticksPaid = upkeep.amount > 0 ? Math.floor(upkeep.stored / upkeep.amount) : 0;
  const days = (upkeep.nextTick - now) / MS_IN_DAY + ticksPaid * upkeep.duration;
  return Math.max(0, days);
}

// Days until fewer than n of the building's upkeep materials still have reserve.
export function buildingDays(building: UserData.GovBurnBuilding, n: number, now: number) {
  const upkeeps = building.upkeeps;
  if (!upkeeps || upkeeps.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const clamped = Math.max(0, Math.min(n, upkeeps.length));
  if (clamped === 0) {
    return Number.POSITIVE_INFINITY;
  }
  // N-th largest materialDays.
  const days = upkeeps.map(x => materialDays(x, now)).sort((a, b) => b - a);
  return days[clamped - 1];
}

// Min over buildings with level > 0, configured n > 0, and upkeeps captured.
export function planetDays(
  planet: UserData.GovBurnPlanet,
  config: UserData.GovBurnPlanetConfig,
  now: number,
) {
  let days = Number.POSITIVE_INFINITY;
  let hasData = false;
  for (const building of planet.buildings) {
    if (building.level <= 0) {
      continue;
    }
    const n = config[building.ticker] ?? 0;
    if (n <= 0) {
      continue;
    }
    if (building.upkeeps === undefined) {
      continue;
    }
    hasData = true;
    days = Math.min(days, buildingDays(building, n, now));
  }
  return { days, hasData };
}

export interface SlotPick {
  ticker: string;
  // How this slot was chosen; 'manual' slots start unresolved in the UI.
  source: 'reserve' | 'own-history' | 'any-history' | 'manual';
}

// Ranks the building's upkeep materials for its n slots.
// Order: stored > 0 (deeper reserve in ticks, stored/amount, first),
// then last own contribution (recent first), then last contribution by
// anyone (recent first). Returns exactly n entries; slots that cannot be
// resolved by any signal get { ticker: '', source: 'manual' } placeholders
// the UI must resolve before execution. n is NOT clamped by data
// availability, only by the building's upkeep count.
export function rankSlots(building: UserData.GovBurnBuilding, n: number): SlotPick[] {
  const upkeeps = building.upkeeps ?? [];
  const slotCount = Math.max(0, Math.min(n, upkeeps.length));
  if (slotCount === 0) {
    return [];
  }

  const history = building.contribHistory ?? {};
  const picked = new Set<string>();
  const result: SlotPick[] = [];

  const reserve = upkeeps
    .map((x, index) => ({
      ticker: x.ticker,
      ticks: x.amount > 0 ? Math.floor(x.stored / x.amount) : 0,
      ratio: x.amount > 0 ? x.stored / x.amount : 0,
      index,
      stored: x.stored,
    }))
    .filter(x => x.stored > 0)
    .sort((a, b) => {
      const byTicks = b.ticks - a.ticks;
      if (byTicks !== 0) {
        return byTicks;
      }
      const byRatio = b.ratio - a.ratio;
      if (byRatio !== 0) {
        return byRatio;
      }
      return a.index - b.index;
    });
  for (const item of reserve) {
    if (result.length >= slotCount) {
      break;
    }
    picked.add(item.ticker);
    result.push({ ticker: item.ticker, source: 'reserve' });
  }

  if (result.length < slotCount) {
    const own = upkeeps
      .map((x, index) => ({
        ticker: x.ticker,
        own: history[x.ticker]?.own,
        index,
      }))
      .filter(x => !picked.has(x.ticker) && x.own !== undefined)
      .sort((a, b) => {
        const byOwn = b.own! - a.own!;
        if (byOwn !== 0) {
          return byOwn;
        }
        return a.index - b.index;
      });
    for (const item of own) {
      if (result.length >= slotCount) {
        break;
      }
      picked.add(item.ticker);
      result.push({ ticker: item.ticker, source: 'own-history' });
    }
  }

  if (result.length < slotCount) {
    const any = upkeeps
      .map((x, index) => ({
        ticker: x.ticker,
        any: history[x.ticker]?.any,
        index,
      }))
      .filter(x => !picked.has(x.ticker) && x.any !== undefined)
      .sort((a, b) => {
        const byAny = b.any! - a.any!;
        if (byAny !== 0) {
          return byAny;
        }
        return a.index - b.index;
      });
    for (const item of any) {
      if (result.length >= slotCount) {
        break;
      }
      picked.add(item.ticker);
      result.push({ ticker: item.ticker, source: 'any-history' });
    }
  }

  while (result.length < slotCount) {
    result.push({ ticker: '', source: 'manual' });
  }
  return result;
}

// Amount of `upkeep` to buy so the material stays supplied for the next
// `horizonDays` days (5..30). Counts consumption ticks at
// nextTick + k*duration that fall within the horizon, but ALWAYS covers at
// least the next tick even when it lies beyond the horizon (a 15-day
// material must be funded for its next tick even at a 5-day horizon).
// Purchases are NOT capped at storeCapacity - players may store excess.
// Returns max(0, ticksToCover * amount - stored).
export function upkeepBuyAmount(upkeep: UserData.GovBurnUpkeep, horizonDays: number, now: number) {
  const daysToNextTick = (upkeep.nextTick - now) / MS_IN_DAY;
  let ticksInHorizon = 0;
  if (upkeep.duration > 0) {
    for (let k = 0; daysToNextTick + k * upkeep.duration <= horizonDays; k++) {
      ticksInHorizon++;
    }
  } else if (daysToNextTick <= horizonDays) {
    ticksInHorizon = 1;
  }
  const ticksToCover = Math.max(1, ticksInHorizon);
  return Math.max(0, ticksToCover * upkeep.amount - upkeep.stored);
}

// Aggregated {ticker: amount} bill for one planet: for each building with
// level > 0 and configured n > 0, buy upkeepBuyAmount for each of the n
// resolved slot tickers. `slots` comes from the UI (rankSlots output after
// the user resolves manual slots); entries with an empty ticker are the
// caller's bug - assert against them.
export function planetGovBurnBill(
  planet: UserData.GovBurnPlanet,
  slotsByBuilding: Record<string, SlotPick[]>,
  horizonDays: number,
  now: number,
): Record<string, number> {
  const bill: Record<string, number> = {};
  for (const building of planet.buildings) {
    if (building.level <= 0) {
      continue;
    }
    const slots = slotsByBuilding[building.ticker];
    if (slots === undefined || slots.length === 0) {
      continue;
    }
    const upkeeps = building.upkeeps;
    if (upkeeps === undefined) {
      continue;
    }
    for (const slot of slots) {
      if (slot.ticker === '') {
        throw new Error(`Unresolved gov burn slot for ${building.ticker}`);
      }
      const upkeep = upkeeps.find(x => x.ticker === slot.ticker);
      if (!upkeep) {
        continue;
      }
      const amount = upkeepBuyAmount(upkeep, horizonDays, now);
      if (amount <= 0) {
        continue;
      }
      bill[slot.ticker] = (bill[slot.ticker] ?? 0) + amount;
    }
  }
  return bill;
}
