<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import PrunButton from '@src/components/PrunButton.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import PlanetRow from '@src/features/XIT/DISPATCH/PlanetRow.vue';
import ShipPool from '@src/features/XIT/DISPATCH/ShipPool.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';
import { useTileState } from '@src/store/user-data-tiles';
import { getPlanetBurn, getResupplyDays } from '@src/core/burn';
import { getRepairLeadDays, getRepairThreshold } from '@src/core/buildings';
import { countDays } from '@src/features/XIT/BURN/utils';
import {
  compareEnRouteLast,
  isOnAutomatedRoute,
} from '@src/features/XIT/ROUTE/automated-route-bases';
import { serializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { allExchangesValue } from '@src/features/XIT/ACT/actions/refuel/utils';
import { setBufferSize, showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { matchUserBufferSize } from '@src/infrastructure/prun-ui/buffer-sizes';
import { resolveDispatchAutoSize } from '@src/features/XIT/DISPATCH/dispatch-buffer-size';
import { stagedDispatch } from '@src/features/XIT/DISPATCH/staged';
import { userData } from '@src/store/user-data';
import { vDraggable } from 'vue-draggable-plus';
import { grip } from '@src/components/grip';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import { useTile } from '@src/hooks/use-tile';
import {
  DispatchBaseConfig,
  DispatchShip,
  billTotals,
  combinedBaseBill,
  fitDaysForShip,
  formatMilkRunOverflow,
  getShipsAtCX,
  materialSizeOf,
  mergeBills,
  planBasesMilkRun,
  regroupByShip,
} from '@src/features/XIT/DISPATCH/utils';
import { computeRepairBill } from '@src/features/XIT/ACT/material-groups/repair/bill';
import {
  CargoBudget,
  allocateDispatchBills,
  assignedShipIds,
  dispatchGroupName,
  fitDaysInBudgets,
  measureBill,
  portionCarriesRepair,
} from '@src/features/XIT/DISPATCH/two-ships';
import { buildTwoPhaseMtraActions } from '@src/features/XIT/ACT/actions/mtra/two-phase';
import {
  MilkRunResult,
  pickupGroupName,
  subtractMaterials,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';

interface BaseEntry {
  siteId: string;
  naturalId: string;
  planetName: string;
  site: PrunApi.Site;
}

const exchangeFilterOptions: { label: string; code: string }[] = [
  { label: 'ANT', code: 'AI1' },
  { label: 'HRT', code: 'IC1' },
  { label: 'MOR', code: 'NC1' },
  { label: 'BEN', code: 'CI1' },
];

const tile = useTile();
const panesEl = ref<HTMLElement | null>(null);
const baseConfigs = useTileState<Record<string, DispatchBaseConfig>>('baseConfigs', {});
const baseOrder = useTileState<string[]>('baseOrder', []);
const orderedIds = ref<string[]>([]);
const exchangeFilter = useTileState<string | undefined>('exchangeFilter', undefined);
const refuel = useTileState<boolean>('refuel', true);

function createBaseConfig(naturalId: string): DispatchBaseConfig {
  return {
    resupply: true,
    repair: false,
    days: getResupplyDays(naturalId) ?? 10,
    repThreshold: getRepairThreshold(naturalId) - getRepairLeadDays(),
    repAdvance: 1,
    materialFilter: 'All',
    cxBuy: true,
    offloadJson: false,
    agent: false,
    ships: [],
  };
}

function burnDaysRemaining(siteId: string) {
  const burn = getPlanetBurn(siteId);
  return burn ? countDays(burn.burn) : Infinity;
}

const bases = computed<BaseEntry[] | undefined>(() => {
  const sites = sitesStore.all.value;
  if (!sites) {
    return undefined;
  }

  return sites
    .map(site => ({
      siteId: site.siteId,
      naturalId: getEntityNaturalIdFromAddress(site.address) ?? '',
      planetName: getEntityNameFromAddress(site.address) ?? '',
      site,
    }))
    .filter(x => x.naturalId);
});

// Fill in missing base configs and patch older persisted configs outside of
// computeds/render to keep them pure.
watchEffect(() => {
  const list = bases.value;
  if (!list) {
    return;
  }
  let next = baseConfigs.value;
  let changed = false;
  for (const base of list) {
    const existing = next[base.naturalId];
    if (existing === undefined) {
      if (!changed) {
        next = { ...next };
        changed = true;
      }
      next[base.naturalId] = createBaseConfig(base.naturalId);
      continue;
    }
    let patched = existing;
    // One-shot: older rows stored a single `ship`. Rewriting every run would
    // loop, so only fill `ships` while it is missing.
    if (!Array.isArray(existing.ships)) {
      patched = { ...patched, ships: existing.ship ? [existing.ship] : [] };
      delete patched.ship;
    }
    if (
      patched.materialFilter === undefined ||
      patched.cxBuy === undefined ||
      patched.offloadJson === undefined ||
      patched.agent === undefined
    ) {
      patched = {
        ...patched,
        materialFilter: existing.materialFilter ?? 'All',
        cxBuy: existing.cxBuy ?? true,
        offloadJson: existing.offloadJson ?? false,
        agent: existing.agent ?? false,
      };
    }
    // One-time migration: the original default was plain getRepairThreshold; the
    // current default matches REPAIRACT (target − lead days). The newDefault check
    // keeps this from re-firing forever when the lead is 0.
    const oldDefault = getRepairThreshold(base.naturalId);
    const newDefault = oldDefault - getRepairLeadDays();
    if (existing.repThreshold === oldDefault && newDefault !== oldDefault) {
      patched = { ...patched, repThreshold: newDefault };
    }
    if (patched !== existing) {
      if (!changed) {
        next = { ...next };
        changed = true;
      }
      next[base.naturalId] = patched;
    }
  }
  if (changed) {
    baseConfigs.value = next;
  }
});

// Bases paired with their configs; configs are filled by the watcher above.
const rows = computed(() =>
  (bases.value ?? [])
    .map(base => ({ base, config: baseConfigs.value[base.naturalId] }))
    .filter(x => x.config !== undefined),
);

// Size the window body to content width after the first data render. The
// game applies the initial bufferSize asynchronously around tile creation,
// so a direct style.width write gets clobbered — go through setBufferSize
// (dispatched after mount, applied last) instead.
const stopWidthWatch = watch([() => rows.value.length, panesEl], async ([length, panes]) => {
  if (length === 0 || !panes) {
    return;
  }
  stopWidthWatch();
  await nextTick();
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
  const bodyEl = windowEl ? (_$(windowEl, C.Window.body) as HTMLElement | null) : null;
  if (!bodyEl) {
    return;
  }
  let contentWidth = 0;
  for (const child of panes.children) {
    contentWidth += (child as HTMLElement).offsetWidth;
  }
  if (panes.scrollWidth > panes.clientWidth) {
    contentWidth = panes.scrollWidth;
  }
  const chrome = bodyEl.offsetWidth - panes.clientWidth;
  const fittedWidth = Math.min(contentWidth + chrome, window.innerWidth - 60);
  const parsedHeight = parseInt(bodyEl.style.height, 10);
  // A XIT SET Buffers rule replaces this measurement, height included.
  // With no rule, fittedWidth and the parsed height are the size, as before.
  const [width, height] = resolveDispatchAutoSize(
    matchUserBufferSize(tile.fullCommand),
    fittedWidth,
    parsedHeight,
  );
  setBufferSize(tile.id, width, height);
});

const rowById = computed(() => {
  const map = new Map<string, { base: BaseEntry; config: DispatchBaseConfig }>();
  for (const row of rows.value) {
    map.set(row.base.naturalId, { base: row.base, config: row.config! });
  }
  return map;
});

// Per-base resupply+repair bill, computed once and shared by the row display,
// the overload check, and execute().
const billByBase = computed(() => {
  const map = new Map<string, Record<string, number>>();
  for (const { base, config } of rows.value) {
    if (!config.resupply && !config.repair) {
      continue;
    }
    const bill = combinedBaseBill(base.naturalId, config, base.site);
    if (bill) {
      map.set(base.naturalId, bill);
    }
  }
  return map;
});

// Keep orderedIds in sync with bases + baseOrder without clobbering an
// in-progress drag reorder.
watchEffect(() => {
  const list = rows.value;
  const present = new Map(list.map(x => [x.base.naturalId, x.base]));
  const ordered: string[] = [];
  for (const id of baseOrder.value) {
    if (present.has(id)) {
      ordered.push(id);
    }
  }
  const orderedSet = new Set(ordered);
  const remaining = list
    .filter(x => !orderedSet.has(x.base.naturalId))
    .map(x => x.base)
    .sort((a, b) => {
      const enRouteOrder = compareEnRouteLast(
        isOnAutomatedRoute(a.naturalId),
        isOnAutomatedRoute(b.naturalId),
      );
      if (enRouteOrder !== 0) {
        return enRouteOrder;
      }
      const daysA = burnDaysRemaining(a.siteId);
      const daysB = burnDaysRemaining(b.siteId);
      if (daysA !== daysB) {
        return daysA - daysB;
      }
      return comparePlanets(a.naturalId, b.naturalId);
    })
    .map(x => x.naturalId);
  const next = [...ordered, ...remaining];
  if (next.length !== orderedIds.value.length || next.some((id, i) => id !== orderedIds.value[i])) {
    orderedIds.value = next;
  }
});

// Groups a row with its first ship. A second ship does not move the row;
// it still receives its own spill load when the dispatch runs.
const shipAssignments = computed(() => {
  const map = new Map<string, string>();
  for (const row of rows.value) {
    const first = assignedShipIds(row.config)[0];
    if (first !== undefined) {
      map.set(row.base.naturalId, first);
    }
  }
  return map;
});

// When a ship is assigned to a second (or later) base, move that base's row
// to sit immediately after the first base already assigned to that ship.
watch(shipAssignments, map => {
  const next = regroupByShip(orderedIds.value, map);
  if (next.some((id, i) => id !== orderedIds.value[i])) {
    orderedIds.value = next;
    baseOrder.value = next;
  }
});

const dragOptions = {
  ...grip.draggable,
  // Drag the tbody so an expanded burn row stays with its base. The
  // draggable selector keeps the thead out of Sortable's index.
  draggable: 'tbody',
  onEnd: (evt: unknown) => {
    grip.draggable.onEnd?.(evt as never);
    baseOrder.value = [...orderedIds.value];
  },
};

// Built in script to pass the ref itself — the template would auto-unwrap
// orderedIds, binding the directive to a stale array snapshot after the sync
// watcher replaces orderedIds.value, which silently breaks drag reordering.
const dragBinding = [orderedIds, dragOptions];

const cxShips = computed(() => getShipsAtCX() ?? []);

// Pool display only — assignment/execution logic always resolves against the
// unfiltered cxShips/cxShipById so a filtered-out ship stays assigned.
const filteredCxShips = computed(() =>
  exchangeFilter.value
    ? cxShips.value.filter(x => x.exchangeCode === exchangeFilter.value)
    : cxShips.value,
);

const cxShipById = computed(() => {
  const map = new Map<string, DispatchShip>();
  for (const entry of cxShips.value) {
    map.set(entry.ship.id, entry);
  }
  return map;
});

// Per-ship milk-run plan (sourcing + route peak). Shared by the row display,
// the overload warning, and execute(). Portions, not full bills: a two-ship
// base fills the first ship and spills the rest onto the second.
const allocation = computed(() => {
  const ships = new Map<string, CargoBudget>();
  for (const [id, entry] of cxShipById.value) {
    const store = entry.cargoStore;
    if (!store || !entry.warehouseStore) {
      continue;
    }
    ships.set(id, {
      freeWeight: store.weightCapacity - store.weightLoad,
      freeVolume: store.volumeCapacity - store.volumeLoad,
    });
  }
  const list: { naturalId: string; shipIds: string[]; bill: Record<string, number> }[] = [];
  for (const id of orderedIds.value) {
    const row = rowById.value.get(id);
    if (!row) {
      continue;
    }
    const { base, config } = row;
    const shipIds = assignedShipIds(config);
    if (shipIds.length === 0 || (!config.resupply && !config.repair)) {
      continue;
    }
    const bill = billByBase.value.get(base.naturalId);
    if (!bill || Object.keys(bill).length === 0) {
      continue;
    }
    list.push({ naturalId: base.naturalId, shipIds, bill });
  }
  return allocateDispatchBills(list, ships, materialSizeOf);
});

const milkRunByShip = computed(() => {
  const byShip = new Map<
    string,
    { naturalId: string; site: PrunApi.Site; days: number; bill: Record<string, number> }[]
  >();
  for (const id of orderedIds.value) {
    const row = rowById.value.get(id);
    const byPortion = allocation.value.portions.get(id);
    if (!row || !byPortion) {
      continue;
    }
    for (const [shipId, materials] of byPortion) {
      if (Object.keys(materials).length === 0) {
        continue;
      }
      let list = byShip.get(shipId);
      if (!list) {
        list = [];
        byShip.set(shipId, list);
      }
      list.push({
        naturalId: row.base.naturalId,
        site: row.base.site,
        days: row.config.days,
        bill: materials,
      });
    }
  }
  const map = new Map<string, MilkRunResult>();
  for (const [shipId, stops] of byShip) {
    const store = cxShipById.value.get(shipId)?.cargoStore;
    if (!store) {
      continue;
    }
    const plan = planBasesMilkRun(stops, store);
    if (plan) {
      map.set(shipId, plan);
    }
  }
  return map;
});

const overloadedShips = computed(() => {
  const result = new Set<string>();
  for (const [shipId, plan] of milkRunByShip.value) {
    if (!plan.fits) {
      result.add(shipId);
    }
  }
  return result;
});

function baseHasLeftover(naturalId: string) {
  const left = allocation.value.leftover.get(naturalId);
  return left !== undefined && Object.keys(left).length > 0;
}

const hasUnallocated = computed(() => orderedIds.value.some(id => baseHasLeftover(id)));

const overflowByStop = computed(() => {
  const map = new Map<string, string>();
  for (const [shipId, plan] of milkRunByShip.value) {
    const entry = cxShipById.value.get(shipId);
    const shipLabel = entry?.ship.name ?? entry?.ship.registration ?? 'Ship';
    for (const overflow of plan.overflows) {
      if (!overflow.stopId) {
        continue;
      }
      const stopLabel = rowById.value.get(overflow.stopId)?.base.planetName ?? overflow.stopId;
      const text = formatMilkRunOverflow(overflow, shipLabel, stopLabel);
      const prev = map.get(overflow.stopId);
      map.set(overflow.stopId, prev ? `${prev} ${text}` : text);
    }
  }
  return map;
});

const pickupByStop = computed(() => {
  const map = new Map<string, { weight: number; volume: number }>();
  for (const [, plan] of milkRunByShip.value) {
    for (const [stopId, loaded] of plan.loadedByStop) {
      const totals = billTotals(loaded);
      const prev = map.get(stopId);
      map.set(
        stopId,
        prev
          ? { weight: prev.weight + totals.weight, volume: prev.volume + totals.volume }
          : totals,
      );
    }
  }
  return map;
});

const hasAssignedShip = computed(() => {
  const list = bases.value;
  if (!list) {
    return false;
  }
  for (const base of list) {
    const config = baseConfigs.value[base.naturalId];
    if (config === undefined) {
      continue;
    }
    if (assignedShipIds(config).some(id => cxShipById.value.has(id))) {
      return true;
    }
  }
  return false;
});

const executeTooltip = computed(() => {
  if (!hasAssignedShip.value) {
    return 'Assign a ship to at least one base first';
  }
  const parts: string[] = [];
  if (hasUnallocated.value) {
    parts.push('Assigned ships cannot hold every resupply and repair material');
  }
  for (const [shipId, plan] of milkRunByShip.value) {
    if (!plan.firstOverflow) {
      continue;
    }
    const entry = cxShipById.value.get(shipId);
    const shipLabel = entry?.ship.name ?? entry?.ship.registration ?? 'Ship';
    const stopId = plan.firstOverflow.stopId;
    const stopLabel = stopId ? (rowById.value.get(stopId)?.base.planetName ?? stopId) : undefined;
    parts.push(formatMilkRunOverflow(plan.firstOverflow, shipLabel, stopLabel));
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' ');
});

function rowOverloaded(id: string) {
  const config = rowById.value.get(id)?.config;
  if (!config) {
    return false;
  }
  if (baseHasLeftover(id)) {
    return true;
  }
  return assignedShipIds(config).some(shipId => overloadedShips.value.has(shipId));
}

// Capacity still free for this base after earlier rows have claimed it.
function budgetForFit(shipId: string, naturalId: string): CargoBudget | undefined {
  const entry = cxShipById.value.get(shipId);
  const store = entry?.cargoStore;
  if (!store || !entry?.warehouseStore) {
    return undefined;
  }
  let freeWeight = store.weightCapacity - store.weightLoad;
  let freeVolume = store.volumeCapacity - store.volumeLoad;
  for (const id of orderedIds.value) {
    if (id === naturalId) {
      break;
    }
    const earlier = rowById.value.get(id);
    if (!earlier || !assignedShipIds(earlier.config).includes(shipId)) {
      continue;
    }
    const shipIds = assignedShipIds(earlier.config);
    const claimed =
      shipIds.length === 1
        ? billByBase.value.get(id)
        : allocation.value.portions.get(id)?.get(shipId);
    if (!claimed) {
      continue;
    }
    const totals = measureBill(claimed, materialSizeOf);
    freeWeight -= totals.weight;
    freeVolume -= totals.volume;
  }
  return {
    freeWeight: Math.max(0, freeWeight),
    freeVolume: Math.max(0, freeVolume),
  };
}

function reservedTwoShipLoad(shipId: string) {
  let weight = 0;
  let volume = 0;
  for (const [baseId, byShip] of allocation.value.portions) {
    const row = rowById.value.get(baseId);
    if (!row || assignedShipIds(row.config).length < 2) {
      continue;
    }
    const portion = byShip.get(shipId);
    if (!portion) {
      continue;
    }
    const totals = measureBill(portion, materialSizeOf);
    weight += totals.weight;
    volume += totals.volume;
  }
  return { weight, volume };
}

function fitBase(naturalId: string) {
  const row = rowById.value.get(naturalId);
  if (!row) {
    return;
  }
  const { config, base } = row;
  const ids = assignedShipIds(config);
  if (ids.length === 0) {
    return;
  }

  if (ids.length >= 2) {
    if (!config.resupply) {
      return;
    }
    const budgets: CargoBudget[] = [];
    for (const shipId of ids) {
      const budget = budgetForFit(shipId, naturalId);
      if (!budget) {
        return;
      }
      budgets.push(budget);
    }
    const days = fitDaysInBudgets(
      budgets,
      days => combinedBaseBill(naturalId, { ...config, days }, base.site),
      materialSizeOf,
    );
    if (days === undefined) {
      return;
    }
    config.days = days;
    return;
  }

  const shipId = ids[0]!;
  const dispatchShip = cxShipById.value.get(shipId);
  if (!dispatchShip?.cargoStore) {
    return;
  }

  const sharingBases = orderedIds.value.flatMap(id => {
    const sharing = rowById.value.get(id);
    return sharing
      ? [{ naturalId: sharing.base.naturalId, config: sharing.config, site: sharing.base.site }]
      : [];
  });

  const days = fitDaysForShip(
    shipId,
    sharingBases,
    dispatchShip.cargoStore,
    reservedTwoShipLoad(shipId),
  );
  if (days === undefined) {
    return;
  }

  for (const sharing of sharingBases) {
    const sharingIds = assignedShipIds(sharing.config);
    if (sharingIds.length === 1 && sharingIds[0] === shipId && sharing.config.resupply) {
      sharing.config.days = days;
    }
  }
}

interface ShipWork {
  naturalId: string;
  config: DispatchBaseConfig;
  dispatchShip: DispatchShip;
  materials: Record<string, number>;
  groupName: string;
  repairBill?: Record<string, number>;
}

function execute() {
  if (overloadedShips.value.size > 0 || hasUnallocated.value) {
    return;
  }

  const groups: UserData.MaterialGroupData[] = [];
  const cxBuyActions: UserData.ActionData[] = [];
  const exchangeBills = new Map<string, Record<string, number>>();
  const byShip = new Map<string, ShipWork[]>();
  const usedGroupNames = new Set<string>();

  for (const id of orderedIds.value) {
    const row = rowById.value.get(id);
    if (!row) {
      continue;
    }
    const { base, config } = row;
    const shipIds = assignedShipIds(config);
    if (shipIds.length === 0 || (!config.resupply && !config.repair)) {
      continue;
    }
    const bill = billByBase.value.get(base.naturalId);
    if (!bill || Object.keys(bill).length === 0) {
      continue;
    }
    const byPortion = allocation.value.portions.get(base.naturalId);
    const repairBill = config.repair
      ? computeRepairBill(base.site, config.repThreshold, config.repAdvance)
      : undefined;
    const planetLabel = base.planetName || base.naturalId;

    for (const shipId of shipIds) {
      const dispatchShip = cxShipById.value.get(shipId);
      if (!dispatchShip?.warehouseStore || !dispatchShip.cargoStore) {
        continue;
      }
      const materials = { ...(byPortion?.get(shipId) ?? {}) };
      const shipLabel = dispatchShip.ship.name ?? dispatchShip.ship.registration;
      let groupName = dispatchGroupName(planetLabel, shipLabel, shipIds.length);
      if (usedGroupNames.has(groupName)) {
        groupName = dispatchGroupName(planetLabel, dispatchShip.ship.registration, shipIds.length);
      }
      usedGroupNames.add(groupName);
      if (Object.keys(materials).length > 0) {
        groups.push({
          type: 'Manual',
          name: groupName,
          planet: base.naturalId,
          materials,
        });
        if (config.cxBuy) {
          const code = dispatchShip.exchangeCode;
          exchangeBills.set(code, mergeBills(exchangeBills.get(code), materials)!);
        }
      }
      let list = byShip.get(shipId);
      if (!list) {
        list = [];
        byShip.set(shipId, list);
      }
      list.push({
        naturalId: base.naturalId,
        config,
        dispatchShip,
        materials,
        groupName,
        repairBill,
      });
    }
  }

  if (byShip.size === 0) {
    return;
  }

  const multiShipGroups: ShipWork[][] = [];
  const singleShipStops: ShipWork[][] = [];
  for (const stops of byShip.values()) {
    if (stops.length >= 2) {
      multiShipGroups.push(stops);
    } else {
      singleShipStops.push(stops);
    }
  }

  const mtraActions: UserData.ActionData[] = [];
  const finishActions: UserData.ActionData[] = [];

  // Two-phase MTRA per ship: transfers first, then finish (offload, agent, SFC)
  // so cargo moves complete before any ship leaves. Both assigned ships are
  // sent, including one whose portion is empty.
  const pushShipMtra = (stops: ShipWork[]) => {
    const first = stops[0]!;
    const dispatchShip = first.dispatchShip;
    const shipName = dispatchShip.ship.name ?? dispatchShip.ship.registration;
    const loadName = `Load ${shipName}`;
    const origin = serializeStorage(dispatchShip.warehouseStore!);
    const dest = serializeStorage(dispatchShip.cargoStore!);

    let materials: Record<string, number> | undefined;
    for (const stop of stops) {
      materials = mergeBills(materials, stop.materials);
    }

    const pickupSourceNames: string[] = [];
    const plan = milkRunByShip.value.get(dispatchShip.ship.id);
    if (plan) {
      materials = subtractMaterials(materials ?? {}, plan.sourced);
      for (const stop of stops) {
        const pickup = plan.pickupsByStop.get(stop.naturalId);
        if (!pickup || Object.keys(pickup).length === 0) {
          continue;
        }
        groups.push({
          type: 'Manual',
          name: pickupGroupName(stop.groupName),
          materials: pickup,
        });
        pickupSourceNames.push(stop.groupName);
      }
      for (const [consumerId, sourced] of plan.sourcedByConsumer) {
        const consumer = stops.find(x => x.naturalId === consumerId);
        if (!consumer?.config.cxBuy) {
          continue;
        }
        const code = consumer.dispatchShip.exchangeCode;
        const buy = exchangeBills.get(code);
        if (buy) {
          exchangeBills.set(code, subtractMaterials(buy, sourced));
        }
      }
    }

    groups.push({
      type: 'Manual',
      name: loadName,
      materials: materials ?? {},
    });

    const carrying = stops.filter(x => Object.keys(x.materials).length > 0);
    const offloadGroups = carrying.filter(x => x.config.offloadJson).map(x => x.groupName);
    const agentGroups = carrying.filter(x => x.config.agent).map(x => x.groupName);
    const repairGroups = carrying
      .filter(x => portionCarriesRepair(x.materials, x.repairBill))
      .map(x => x.groupName);

    const { load, finish } = buildTwoPhaseMtraActions({
      loadName,
      finishName: `Offload ${shipName}`,
      group: loadName,
      origin,
      dest,
      sfcDestination:
        stops.find(x => Object.keys(x.materials).length > 0)?.naturalId ?? first.naturalId,
      offloadGroups,
      agentGroups,
      repairGroups,
      pickupGroups: pickupSourceNames,
    });
    mtraActions.push(load);
    finishActions.push(finish);
  };

  for (const stops of multiShipGroups) {
    pushShipMtra(stops);
  }
  for (const stops of singleShipStops) {
    pushShipMtra(stops);
  }

  for (const [code, materials] of exchangeBills) {
    if (Object.keys(materials).length === 0) {
      continue;
    }
    const groupName = `Buy ${code}`;
    groups.push({
      type: 'Manual',
      name: groupName,
      materials,
    });
    cxBuyActions.push({
      type: 'CX Buy',
      name: groupName,
      group: groupName,
      exchange: code,
      useCXInv: true,
      skippable: true,
    });
  }

  const refuelAction: UserData.ActionData = {
    type: 'Refuel',
    name: 'Refuel',
    origin: allExchangesValue,
    buyMissingFuel: true,
  };

  const pkg: UserData.ActionPackageData = {
    global: { name: 'Dispatch' },
    groups,
    actions: [
      ...(refuel.value ? [refuelAction] : []),
      ...cxBuyActions,
      ...mtraActions,
      ...finishActions,
    ],
  };

  stagedDispatch.value = {
    // Deep-clone to detach from tile-state reactivity.
    pkg: JSON.parse(JSON.stringify(pkg)),
  };
  showBuffer('XIT DISPATCHACT');
}
function reset() {
  baseConfigs.value = {};
  baseOrder.value = [];
}
</script>

<template>
  <LoadingSpinner v-if="bases === undefined" />
  <div v-else :class="$style.layout">
    <div :class="C.ComExOrdersPanel.filter">
      <RadioItem
        v-for="option in exchangeFilterOptions"
        :key="option.code"
        :model-value="exchangeFilter === option.code"
        horizontal
        @update:model-value="v => (exchangeFilter = v ? option.code : undefined)">
        {{ option.label }}
      </RadioItem>
      <div :class="$style.separator" />
      <RadioItem v-model="refuel" horizontal>REFUEL</RadioItem>
      <RadioItem v-model="userData.settings.cxPricesPreview" horizontal>PRICES</RadioItem>
      <div :class="$style.spacer" />
      <PrunButton dark @click="reset">RESET</PrunButton>
      <PrunButton
        primary
        :class="$style.executeButton"
        :disabled="overloadedShips.size > 0 || hasUnallocated"
        :data-tooltip="executeTooltip"
        @click="execute">
        EXECUTE
      </PrunButton>
    </div>
    <div ref="panesEl" :class="$style.panes">
      <ShipPool :ships="filteredCxShips" :base-configs="baseConfigs" />
      <div :class="$style.left">
        <table v-draggable="dragBinding" :class="$style.table">
          <thead>
            <tr>
              <th :class="[$style.narrowCol, $style.centered]">Assign</th>
              <GripHeaderCell />
              <th :class="[$style.narrowCol, $style.centered]">Planet</th>
              <th :class="[$style.narrowCol, $style.centered]" colspan="2">Burn</th>
              <th :class="[$style.narrowCol, $style.centered]" colspan="2">Rep</th>
              <th :class="[$style.narrowCol, $style.centered]">Load</th>
              <th :class="[$style.narrowCol, $style.centered]">Materials</th>
              <th :class="[$style.narrowCol, $style.centered]">Fit</th>
              <th :class="[$style.narrowCol, $style.centered]">Days</th>
              <th :class="[$style.narrowCol, $style.centered]">Rep ≥</th>
              <th :class="[$style.narrowCol, $style.centered]">Adv</th>
              <th :class="[$style.narrowCol, $style.centered]">CX</th>
              <th :class="[$style.narrowCol, $style.centered]">Offload</th>
              <th :class="[$style.narrowCol, $style.centered]">Agent</th>
            </tr>
          </thead>
          <tbody v-for="id in orderedIds" :key="id">
            <PlanetRow
              :site-id="rowById.get(id)!.base.siteId"
              :natural-id="rowById.get(id)!.base.naturalId"
              :planet-name="rowById.get(id)!.base.planetName"
              :config="rowById.get(id)!.config"
              :bill="billByBase.get(id)"
              :overloaded="rowOverloaded(id)"
              :peak-overflow="overflowByStop.has(id)"
              :overflow-tooltip="overflowByStop.get(id)"
              :pickup-weight="pickupByStop.get(id)?.weight"
              :pickup-volume="pickupByStop.get(id)?.volume"
              @fit="fitBase(rowById.get(id)!.base.naturalId)" />
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style module>
.layout {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.spacer {
  flex: 1;
}

.separator {
  width: 1px;
  align-self: stretch;
  background-color: #2b485a;
  margin: 0 0.25rem;
}

/* No inner scroller — the game's ScrollView scrolls the tile like every
   other buffer, so no scrollbar width is reserved inside the window. */
.panes {
  display: flex;
  flex-direction: row;
}

.left {
  flex: 0 0 auto;
  min-width: 0;
  overflow: visible;
}

.table {
  border-collapse: collapse;
}

.table thead tr {
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.narrowCol {
  width: 0;
  white-space: nowrap;
}

.centered {
  text-align: center;
}

.executeButton {
  white-space: normal;
}
</style>
