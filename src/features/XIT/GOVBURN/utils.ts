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
