// Two ships on one DISPATCH base: assignment order, fill-then-spill, combined fit.
// Plain data in, plain data out. DISPATCH.vue wires cargo stores and bills.

import { maxFittingDays } from '@src/features/XIT/ACT/material-groups/resupply/fit-days';

export const MAX_SHIPS_PER_BASE = 2;

export interface ShipAssignmentConfig {
  ships?: readonly string[];
  ship?: string;
}

export interface CargoBudget {
  freeWeight: number;
  freeVolume: number;
}

export interface MaterialSize {
  weight: number;
  volume: number;
}

export type MaterialSizeOf = (ticker: string) => MaterialSize | undefined;

export interface AllocBase {
  naturalId: string;
  shipIds: readonly string[];
  bill: Record<string, number>;
}

export interface DispatchAllocation {
  // Every sendable ship on the base, including an empty portion.
  portions: Map<string, Map<string, Record<string, number>>>;
  leftover: Map<string, Record<string, number>>;
}

const PACK_EPSILON = 0.000001;

export function assignedShipIds(assignment: ShipAssignmentConfig): string[] {
  const raw = Array.isArray(assignment.ships)
    ? assignment.ships
    : assignment.ship
      ? [assignment.ship]
      : [];
  const ids: string[] = [];
  for (const id of raw) {
    if (id.length === 0 || ids.includes(id)) {
      continue;
    }
    ids.push(id);
    if (ids.length === MAX_SHIPS_PER_BASE) {
      break;
    }
  }
  return ids;
}

// Drop order is assignment order. A third drop and a duplicate are ignored.
export function assignDroppedShip(current: readonly string[], shipId: string): string[] {
  if (shipId.length === 0 || current.includes(shipId) || current.length >= MAX_SHIPS_PER_BASE) {
    return [...current];
  }
  return [...current, shipId];
}

export function removeAssignedShip(current: readonly string[], shipId: string): string[] {
  return current.filter(id => id !== shipId);
}

export function dispatchGroupName(planetName: string, shipLabel: string, shipCount: number) {
  if (shipCount < 2) {
    return planetName;
  }
  return `${planetName} (${shipLabel})`;
}

export function measureBill(bill: Record<string, number>, sizeOf: MaterialSizeOf) {
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(bill)) {
    const size = sizeOf(ticker);
    if (!size || amount <= 0) {
      continue;
    }
    weight += size.weight * amount;
    volume += size.volume * amount;
  }
  return { weight, volume };
}

export function portionCarriesRepair(
  portion: Record<string, number>,
  repair: Record<string, number> | undefined,
) {
  if (repair === undefined) {
    return false;
  }
  for (const ticker of Object.keys(portion)) {
    if ((portion[ticker] ?? 0) > 0 && (repair[ticker] ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

function addAmount(target: Record<string, number>, ticker: string, amount: number) {
  target[ticker] = (target[ticker] ?? 0) + amount;
}

function unitsThatFit(amount: number, size: MaterialSize, budget: CargoBudget) {
  let cap = amount;
  if (size.weight > 0) {
    cap = Math.min(cap, Math.floor((budget.freeWeight + PACK_EPSILON) / size.weight));
  }
  if (size.volume > 0) {
    cap = Math.min(cap, Math.floor((budget.freeVolume + PACK_EPSILON) / size.volume));
  }
  if (cap < 0) {
    return 0;
  }
  return cap;
}

// Fills budgets[0] completely before writing anything into budgets[1].
export function splitBillAcrossShips(
  bill: Record<string, number>,
  budgets: readonly CargoBudget[],
  sizeOf: MaterialSizeOf,
): { portions: Record<string, number>[]; leftover: Record<string, number> } {
  const remaining = budgets.map(budget => ({
    freeWeight: Math.max(0, budget.freeWeight),
    freeVolume: Math.max(0, budget.freeVolume),
  }));
  const portions = budgets.map(() => ({}) as Record<string, number>);
  const leftover: Record<string, number> = {};
  for (const ticker of Object.keys(bill).sort()) {
    let amount = bill[ticker] ?? 0;
    if (amount <= 0) {
      continue;
    }
    const size = sizeOf(ticker);
    if (size === undefined || (size.weight <= 0 && size.volume <= 0)) {
      const first = portions[0];
      if (first === undefined) {
        leftover[ticker] = amount;
      } else {
        addAmount(first, ticker, amount);
      }
      continue;
    }
    for (let i = 0; i < remaining.length && amount > 0; i++) {
      const budget = remaining[i]!;
      const fit = unitsThatFit(amount, size, budget);
      if (fit <= 0) {
        continue;
      }
      addAmount(portions[i]!, ticker, fit);
      budget.freeWeight -= size.weight * fit;
      budget.freeVolume -= size.volume * fit;
      amount -= fit;
    }
    if (amount > 0) {
      leftover[ticker] = amount;
    }
  }
  return { portions, leftover };
}

function subtractBudget(budget: CargoBudget, bill: Record<string, number>, sizeOf: MaterialSizeOf) {
  const totals = measureBill(bill, sizeOf);
  budget.freeWeight -= totals.weight;
  budget.freeVolume -= totals.volume;
}

// List order. A one-ship base keeps its whole bill on that ship. A two-ship
// base fills the first sendable ship, then spills. Earlier claims reduce the
// free hold later bases see, so one ship is not packed twice at departure.
export function allocateDispatchBills(
  bases: readonly AllocBase[],
  ships: ReadonlyMap<string, CargoBudget>,
  sizeOf: MaterialSizeOf,
): DispatchAllocation {
  const budgets = new Map<string, CargoBudget>();
  for (const [id, budget] of ships) {
    budgets.set(id, { freeWeight: budget.freeWeight, freeVolume: budget.freeVolume });
  }

  const portions = new Map<string, Map<string, Record<string, number>>>();
  const leftover = new Map<string, Record<string, number>>();

  for (const base of bases) {
    const sendable = base.shipIds.filter(id => budgets.has(id));
    const byShip = new Map<string, Record<string, number>>();
    portions.set(base.naturalId, byShip);
    if (sendable.length === 0) {
      if (Object.keys(base.bill).length > 0) {
        leftover.set(base.naturalId, { ...base.bill });
      }
      continue;
    }
    if (sendable.length === 1 || base.shipIds.length < 2) {
      const shipId = sendable[0]!;
      byShip.set(shipId, { ...base.bill });
      subtractBudget(budgets.get(shipId)!, base.bill, sizeOf);
      continue;
    }
    const split = splitBillAcrossShips(
      base.bill,
      sendable.map(id => budgets.get(id)!),
      sizeOf,
    );
    for (let i = 0; i < sendable.length; i++) {
      const materials = split.portions[i] ?? {};
      byShip.set(sendable[i]!, materials);
      subtractBudget(budgets.get(sendable[i]!)!, materials, sizeOf);
    }
    if (Object.keys(split.leftover).length > 0) {
      leftover.set(base.naturalId, split.leftover);
    }
  }

  return { portions, leftover };
}

export function fitDaysInBudgets(
  budgets: readonly CargoBudget[],
  billAt: (days: number) => Record<string, number> | undefined,
  sizeOf: MaterialSizeOf,
): number | undefined {
  if (billAt(0) === undefined) {
    return undefined;
  }
  return maxFittingDays(days => {
    const bill = billAt(days);
    if (bill === undefined) {
      return false;
    }
    return Object.keys(splitBillAcrossShips(bill, budgets, sizeOf).leftover).length === 0;
  });
}
