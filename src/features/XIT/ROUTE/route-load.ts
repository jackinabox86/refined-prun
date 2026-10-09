import { computeResupplyBill } from '@src/features/XIT/ACT/material-groups/resupply/bill';
import {
  addMaterials,
  expectedOutputQty,
  planMilkRun,
  sourcedDayBuffer,
  subtractMaterials,
  type MilkRunResult,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import {
  baseDailyAmount,
  materialSizeOf,
  type MilkRunBase,
} from '@src/features/XIT/DISPATCH/utils';
import { getPlanetBurn } from '@src/core/burn';
import type { FuelLoad } from '@src/features/XIT/ROUTE/route-calc';
import { routeSegments } from '@src/features/XIT/ROUTE/route-stops';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';

// A route runs unattended for many cycles, so its bill is pure consumption over
// the supply days. Stock that happens to be on the base today is not subtracted.
const resupplyGroup = { type: 'Resupply' as const, useBaseInv: false };

// Undefined means a base is missing burn data, same gate as DISPATCH fit.
export function routeBaseBills(
  stops: readonly { kind: 'cx' | 'base'; id: string }[],
  days: number,
  fuel: readonly FuelLoad[],
): MilkRunBase[] | undefined {
  const billed: MilkRunBase[] = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop === undefined || stop.kind !== 'base') {
      continue;
    }
    const site = sitesStore.getByPlanetNaturalId(stop.id);
    if (site === undefined) {
      continue;
    }
    const bill = computeResupplyBill(resupplyGroup, stop.id, days);
    if (bill === undefined || baseDailyAmount(site.siteId) === undefined) {
      return undefined;
    }
    const extra = fuel[i];
    if (extra !== undefined && extra.stl > 0) {
      bill.SF = (bill.SF ?? 0) + Math.ceil(extra.stl);
    }
    if (extra !== undefined && extra.ftl > 0) {
      bill.FF = (bill.FF ?? 0) + Math.ceil(extra.ftl);
    }
    billed.push({
      naturalId: stop.id,
      site,
      days,
      bill,
    });
  }
  return billed;
}

// What each base uses of its own net outputs over the supply days, billed the
// same way as an input: ceil(days x daily use + 1).
export function ownUseByStop(bases: readonly MilkRunBase[]) {
  const result = new Map<string, Record<string, number>>();
  for (const base of bases) {
    const burn = getPlanetBurn(base.site.siteId)?.burn ?? {};
    const use: Record<string, number> = {};
    for (const [ticker, value] of Object.entries(burn)) {
      const daily = value.input + value.workforce;
      if (value.dailyAmount > 0 && daily > 0) {
        use[ticker] = Math.ceil(base.days * daily + 1);
      }
    }
    result.set(base.naturalId, use);
  }
  return result;
}

export interface OriginSegmentPlan {
  originIndex: number;
  bases: MilkRunBase[];
  plan: MilkRunResult;
}

// Each stretch between origin visits is its own load. A single visit is one plan
// over every base, which is the whole route.
export function planOriginSegments(
  stops: readonly { kind: 'cx' | 'base'; id: string }[],
  days: number,
  fuel: readonly FuelLoad[],
  cargo: PrunApi.Store,
): OriginSegmentPlan[] | undefined {
  const segments = routeSegments(stops);
  const groups = segments.length > 0 ? segments : [stops];
  let offset = 0;
  const planned: OriginSegmentPlan[] = [];
  for (let i = 0; i < groups.length; i++) {
    const segment = groups[i] ?? [];
    const slice = fuel.slice(offset, offset + segment.length);
    // A later origin visit reloads for the stops after it. It is not a second delivery.
    const billStops = i === 0 ? segment : segment.slice(1);
    const billFuel = i === 0 ? slice : slice.slice(1);
    const bases = routeBaseBills(billStops, days, billFuel);
    if (bases === undefined) {
      return undefined;
    }
    planned.push({
      originIndex: offset,
      bases,
      plan: planRouteLoads(bases, cargo),
    });
    offset += segment.length;
  }
  return planned;
}

export function planRouteLoads(bases: MilkRunBase[], cargo: PrunApi.Store): MilkRunResult {
  const stops = bases.map(base => {
    const dailyAmount = baseDailyAmount(base.site.siteId) ?? {};
    // Pick-ups come from what the base produces over the route's days, not
    // from today's stock, so the plan holds for every later cycle. takeableAmount
    // holds 1 unit back at the source; the route takes the whole output, so add it.
    const storeQty = expectedOutputQty(dailyAmount, base.days);
    for (const ticker of Object.keys(storeQty)) {
      storeQty[ticker] = (storeQty[ticker] ?? 0) + 1;
    }
    return {
      id: base.naturalId,
      days: base.days,
      bill: base.bill,
      storeQty,
      dailyAmount,
    };
  });
  const input = {
    stops,
    // A route is a future plan. The cell prints the bill, and the owner
    // compares that number to the ship's capacity. Cargo already in the
    // hold is not part of either, so the check starts from an empty hold.
    cargo: {
      weightLoad: 0,
      volumeLoad: 0,
      weightCapacity: cargo.weightCapacity,
      volumeCapacity: cargo.volumeCapacity,
    },
    sizeOf: materialSizeOf,
  };
  // Transfers do not depend on the departure load, so a second pass only adds the buffer.
  const first = planMilkRun(input);
  const departureExtra = sourcedDayBuffer(stops, first.transfers);
  if (Object.keys(departureExtra).length === 0) {
    return first;
  }
  return planMilkRun({ ...input, departureExtra });
}

export function departureBill(
  bases: readonly MilkRunBase[],
  sourced: Record<string, number>,
  extra?: Record<string, number>,
) {
  let bill: Record<string, number> = {};
  for (const base of bases) {
    bill = addMaterials(bill, base.bill);
  }
  return addMaterials(subtractMaterials(bill, sourced), extra);
}
