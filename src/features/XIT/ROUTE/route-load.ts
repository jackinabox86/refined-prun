import { computeResupplyBill } from '@src/features/XIT/ACT/material-groups/resupply/bill';
import {
  addMaterials,
  planMilkRun,
  subtractMaterials,
  type MilkRunResult,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import {
  baseDailyAmount,
  baseStoreQty,
  materialSizeOf,
  type MilkRunBase,
} from '@src/features/XIT/DISPATCH/utils';
import type { FuelLoad } from '@src/features/XIT/ROUTE/route-calc';
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

export function planRouteLoads(bases: MilkRunBase[], cargo: PrunApi.Store): MilkRunResult {
  return planMilkRun({
    stops: bases.map(base => {
      const dailyAmount = baseDailyAmount(base.site.siteId) ?? {};
      return {
        id: base.naturalId,
        days: base.days,
        bill: base.bill,
        storeQty: Object.keys(dailyAmount).length > 0 ? baseStoreQty(base.site.siteId) : {},
        dailyAmount,
      };
    }),
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
  });
}

export function departureBill(bases: readonly MilkRunBase[], sourced: Record<string, number>) {
  let bill: Record<string, number> = {};
  for (const base of bases) {
    bill = addMaterials(bill, base.bill);
  }
  return subtractMaterials(bill, sourced);
}
