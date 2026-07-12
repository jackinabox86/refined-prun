<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import PrunButton from '@src/components/PrunButton.vue';
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
import { getRepairOffset, getRepairThreshold } from '@src/core/buildings';
import { countDays } from '@src/features/XIT/BURN/utils';
import { serializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { allExchangesValue } from '@src/features/XIT/ACT/actions/refuel/utils';
import { setBufferSize, showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { stagedDispatch } from '@src/features/XIT/DISPATCH/staged';
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
  getShipsAtCX,
  mergeBills,
} from '@src/features/XIT/DISPATCH/utils';

interface BaseEntry {
  siteId: string;
  naturalId: string;
  planetName: string;
  site: PrunApi.Site;
}

const tile = useTile();
const panesEl = ref<HTMLElement | null>(null);
const baseConfigs = useTileState<Record<string, DispatchBaseConfig>>('baseConfigs', {});
const baseOrder = useTileState<string[]>('baseOrder', []);
const orderedIds = ref<string[]>([]);

function createBaseConfig(naturalId: string): DispatchBaseConfig {
  return {
    resupply: true,
    repair: false,
    days: getResupplyDays(naturalId) ?? 10,
    repThreshold: getRepairThreshold(naturalId) - getRepairOffset(naturalId),
    repAdvance: 1,
    materialFilter: 'All',
    cxBuy: true,
    offloadJson: false,
    agent: false,
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
    if (
      existing.materialFilter === undefined ||
      existing.cxBuy === undefined ||
      existing.offloadJson === undefined ||
      existing.agent === undefined
    ) {
      patched = {
        ...patched,
        materialFilter: existing.materialFilter ?? 'All',
        cxBuy: existing.cxBuy ?? true,
        offloadJson: existing.offloadJson ?? false,
        agent: existing.agent ?? false,
      };
    }
    // One-time migration: old default was plain getRepairThreshold; new default
    // matches REPAIRACT (threshold − offset).
    const oldDefault = getRepairThreshold(base.naturalId);
    if (existing.repThreshold === oldDefault) {
      patched = {
        ...patched,
        repThreshold: oldDefault - getRepairOffset(base.naturalId),
      };
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
  const width = Math.min(contentWidth + chrome, window.innerWidth - 60);
  const parsedHeight = parseInt(bodyEl.style.height, 10);
  const height = isNaN(parsedHeight) ? 500 : parsedHeight;
  setBufferSize(tile.id, width, height);
});

const rowById = computed(() => {
  const map = new Map<string, { base: BaseEntry; config: DispatchBaseConfig }>();
  for (const row of rows.value) {
    map.set(row.base.naturalId, { base: row.base, config: row.config! });
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

const dragOptions = {
  ...grip.draggable,
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

const cxShipById = computed(() => {
  const map = new Map<string, DispatchShip>();
  for (const entry of cxShips.value) {
    map.set(entry.ship.id, entry);
  }
  return map;
});

// Ships whose assigned bases' combined bills exceed free cargo capacity.
const overloadedShips = computed(() => {
  const totals = new Map<string, { weight: number; volume: number }>();
  for (const { base, config } of rows.value) {
    if (!config.ship || (!config.resupply && !config.repair)) {
      continue;
    }
    const bill = combinedBaseBill(base.naturalId, config!, base.site);
    if (!bill) {
      continue;
    }
    const billT = billTotals(bill);
    const acc = totals.get(config.ship) ?? { weight: 0, volume: 0 };
    acc.weight += billT.weight;
    acc.volume += billT.volume;
    totals.set(config.ship, acc);
  }
  const result = new Set<string>();
  for (const [shipId, t] of totals) {
    const store = cxShipById.value.get(shipId)?.cargoStore;
    if (!store) {
      continue;
    }
    // Free capacity net of whatever is already in the cargo hold, matching FIT.
    if (
      t.weight > store.weightCapacity - store.weightLoad ||
      t.volume > store.volumeCapacity - store.volumeLoad
    ) {
      result.add(shipId);
    }
  }
  return result;
});

const hasAssignedShip = computed(() => {
  const list = bases.value;
  if (!list) {
    return false;
  }
  for (const base of list) {
    const config = baseConfigs.value[base.naturalId];
    if (config?.ship && cxShipById.value.has(config.ship)) {
      return true;
    }
  }
  return false;
});

const executeTooltip = computed(() => {
  if (!hasAssignedShip.value) {
    return 'Assign a ship to at least one base first';
  }
  if (overloadedShips.value.size > 0) {
    return 'A ship is loaded above its capacity';
  }
  return undefined;
});

interface IncludedBase {
  naturalId: string;
  planetName: string;
  site: PrunApi.Site;
  config: DispatchBaseConfig;
  dispatchShip: DispatchShip;
}

const includedBases = computed(() => {
  // Dispatch LIST order (user-reorderable), not sites order.
  const result: IncludedBase[] = [];
  for (const id of orderedIds.value) {
    const row = rowById.value.get(id);
    if (!row) {
      continue;
    }
    const { base, config } = row;
    if (!config.ship || (!config.resupply && !config.repair)) {
      continue;
    }
    const dispatchShip = cxShipById.value.get(config.ship);
    if (!dispatchShip?.warehouseStore || !dispatchShip.cargoStore) {
      continue;
    }
    result.push({
      naturalId: base.naturalId,
      planetName: base.planetName,
      site: base.site,
      config,
      dispatchShip,
    });
  }
  return result;
});

function fitBase(naturalId: string) {
  const config = baseConfigs.value[naturalId];
  if (!config?.ship) {
    return;
  }
  const dispatchShip = cxShipById.value.get(config.ship);
  if (!dispatchShip?.cargoStore) {
    return;
  }

  const sharingBases = rows.value.map(x => ({
    naturalId: x.base.naturalId,
    config: x.config!,
    site: x.base.site,
  }));

  const days = fitDaysForShip(config.ship, sharingBases, dispatchShip.cargoStore);
  if (days === undefined) {
    return;
  }

  for (const base of sharingBases) {
    if (base.config.ship === config.ship && base.config.resupply) {
      base.config.days = days;
    }
  }
}

function execute() {
  if (includedBases.value.length === 0) {
    return;
  }
  if (overloadedShips.value.size > 0) {
    return;
  }

  const groups: UserData.MaterialGroupData[] = [];
  const cxBuyActions: UserData.ActionData[] = [];

  // Per-exchange aggregate of bills for bases with cxBuy on.
  const exchangeBills = new Map<string, Record<string, number>>();
  // Bases that actually stage (non-empty bill), in list order.
  const stagedBases: IncludedBase[] = [];

  for (const base of includedBases.value) {
    const { naturalId, site, config, dispatchShip } = base;
    const bill = combinedBaseBill(naturalId, config, site);
    if (!bill || Object.keys(bill).length === 0) {
      continue;
    }

    stagedBases.push(base);

    groups.push({
      type: 'Manual',
      name: naturalId,
      planet: naturalId,
      materials: bill,
    });

    if (config.cxBuy) {
      const code = dispatchShip.exchangeCode;
      exchangeBills.set(code, mergeBills(exchangeBills.get(code), bill)!);
    }
  }

  if (stagedBases.length === 0) {
    return;
  }

  // Group by ship, preserving list order within each group and insertion
  // order of first-seen ships.
  const byShip = new Map<string, IncludedBase[]>();
  for (const base of stagedBases) {
    const shipId = base.config.ship!;
    let list = byShip.get(shipId);
    if (!list) {
      list = [];
      byShip.set(shipId, list);
    }
    list.push(base);
  }

  // Multi-base ships first (order of each ship's first base in the list),
  // then single-base ships.
  const multiShipGroups: IncludedBase[][] = [];
  const singleShipBases: IncludedBase[] = [];
  for (const shipBases of byShip.values()) {
    if (shipBases.length >= 2) {
      multiShipGroups.push(shipBases);
    } else {
      singleShipBases.push(shipBases[0]!);
    }
  }

  const mtraActions: UserData.ActionData[] = [];
  const finishActions: UserData.ActionData[] = [];

  // Two-phase MTRA per ship: transfer actions first (all ships), then finish
  // actions (offload JSONs, agent posts, SFC) so cargo moves complete before
  // any ship's SFC. One material group per ship (sum of base bills).
  const pushShipMtra = (shipBases: IncludedBase[]) => {
    const first = shipBases[0]!;
    const dispatchShip = first.dispatchShip;
    const shipName = dispatchShip.ship.name ?? dispatchShip.ship.registration;
    const loadName = `Load ${shipName}`;
    const origin = serializeStorage(dispatchShip.warehouseStore!);
    const dest = serializeStorage(dispatchShip.cargoStore!);

    let materials: Record<string, number> | undefined;
    for (const base of shipBases) {
      const group = groups.find(x => x.name === base.naturalId);
      materials = mergeBills(materials, group?.materials);
    }

    groups.push({
      type: 'Manual',
      name: loadName,
      materials: materials!,
    });

    // Offload = JSON print; agent = post to agent channel (chain ids for 2+ stops).
    const offloadGroups = shipBases.filter(x => x.config.offloadJson).map(x => x.naturalId);
    const agentGroups = shipBases.filter(x => x.config.agent).map(x => x.naturalId);
    const repairGroups = shipBases.filter(x => x.config.repair).map(x => x.naturalId);

    mtraActions.push({
      type: 'MTRA',
      name: loadName,
      group: loadName,
      origin,
      dest,
      noSfc: true,
    });

    finishActions.push({
      type: 'MTRA',
      name: `Offload ${shipName}`,
      group: loadName,
      origin,
      dest,
      finishOnly: true,
      sfcDestination: first.naturalId,
      ...(offloadGroups.length > 0 ? { offloadGroups } : {}),
      ...(agentGroups.length > 0 ? { agentGroups } : {}),
      ...(repairGroups.length > 0 ? { repairGroups } : {}),
    });
  };

  for (const shipBases of multiShipGroups) {
    pushShipMtra(shipBases);
  }

  for (const base of singleShipBases) {
    pushShipMtra([base]);
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
    actions: [refuelAction, ...cxBuyActions, ...mtraActions, ...finishActions],
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
    <div :class="$style.executeBar">
      <PrunButton dark @click="reset">RESET</PrunButton>
      <PrunButton
        primary
        :disabled="overloadedShips.size > 0"
        :data-tooltip="executeTooltip"
        @click="execute">
        EXECUTE
      </PrunButton>
    </div>
    <div ref="panesEl" :class="$style.panes">
      <ShipPool :ships="cxShips" :base-configs="baseConfigs" />
      <div :class="$style.left">
        <table :class="$style.table">
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
          <tbody v-draggable="dragBinding">
            <PlanetRow
              v-for="id in orderedIds"
              :key="id"
              :site-id="rowById.get(id)!.base.siteId"
              :natural-id="rowById.get(id)!.base.naturalId"
              :planet-name="rowById.get(id)!.base.planetName"
              :config="rowById.get(id)!.config"
              :overloaded="
                !!rowById.get(id)!.config.ship && overloadedShips.has(rowById.get(id)!.config.ship!)
              "
              @fit="fitBase(rowById.get(id)!.base.naturalId)" />
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style module>
.layout {
  --dispatch-row-height: 24px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.executeBar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: var(--dispatch-row-height);
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0 8px;
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
  height: var(--dispatch-row-height);
  line-height: var(--dispatch-row-height);
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.table thead th {
  height: var(--dispatch-row-height);
  line-height: var(--dispatch-row-height);
  padding: 0 4px;
  box-sizing: border-box;
}

.narrowCol {
  width: 0;
  white-space: nowrap;
}

.centered {
  text-align: center;
}
</style>
