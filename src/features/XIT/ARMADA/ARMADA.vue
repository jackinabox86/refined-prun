<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import PrunButton from '@src/components/PrunButton.vue';
import PlanetRow from '@src/features/XIT/ARMADA/PlanetRow.vue';
import ShipPool from '@src/features/XIT/ARMADA/ShipPool.vue';
import AdvancedRow from '@src/features/XIT/ARMADA/AdvancedRow.vue';
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
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { stagedArmada, type StagedOffload } from '@src/features/XIT/ARMADA/staged';
import { vDraggable } from 'vue-draggable-plus';
import { grip } from '@src/components/grip';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import {
  ArmadaBaseConfig,
  ArmadaShip,
  combinedBaseBill,
  fitDaysForShip,
  getShipsAtCX,
  mergeBills,
} from '@src/features/XIT/ARMADA/utils';

interface BaseEntry {
  siteId: string;
  naturalId: string;
  planetName: string;
  site: PrunApi.Site;
}

const baseConfigs = useTileState<Record<string, ArmadaBaseConfig>>('baseConfigs', {});
const baseOrder = useTileState<string[]>('baseOrder', []);
const orderedIds = ref<string[]>([]);

function createBaseConfig(naturalId: string): ArmadaBaseConfig {
  return {
    resupply: true,
    repair: false,
    days: getResupplyDays(naturalId) ?? 10,
    repThreshold: getRepairThreshold(naturalId) - getRepairOffset(naturalId),
    repAdvance: 1,
    materialFilter: 'All',
    cxBuy: true,
    offloadJson: false,
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
      existing.offloadJson === undefined
    ) {
      patched = {
        ...patched,
        materialFilter: existing.materialFilter ?? 'All',
        cxBuy: existing.cxBuy ?? true,
        offloadJson: existing.offloadJson ?? false,
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

const rowById = computed(() => {
  const map = new Map<string, { base: BaseEntry; config: ArmadaBaseConfig }>();
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

const cxShips = computed(() => getShipsAtCX() ?? []);

const cxShipById = computed(() => {
  const map = new Map<string, ArmadaShip>();
  for (const entry of cxShips.value) {
    map.set(entry.ship.id, entry);
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
    if (config?.ship && cxShipById.value.has(config.ship)) {
      return true;
    }
  }
  return false;
});

const executeTooltip = computed(() =>
  hasAssignedShip.value ? undefined : 'Assign a ship to at least one base first',
);

interface IncludedBase {
  naturalId: string;
  planetName: string;
  site: PrunApi.Site;
  config: ArmadaBaseConfig;
  armadaShip: ArmadaShip;
}

const includedBases = computed(() => {
  // Armada LIST order (user-reorderable), not sites order.
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
    const armadaShip = cxShipById.value.get(config.ship);
    if (!armadaShip?.warehouseStore || !armadaShip.cargoStore) {
      continue;
    }
    result.push({
      naturalId: base.naturalId,
      planetName: base.planetName,
      site: base.site,
      config,
      armadaShip,
    });
  }
  return result;
});

function fitBase(naturalId: string) {
  const config = baseConfigs.value[naturalId];
  if (!config?.ship) {
    return;
  }
  const armadaShip = cxShipById.value.get(config.ship);
  if (!armadaShip?.cargoStore) {
    return;
  }

  const sharingBases = rows.value.map(x => ({
    naturalId: x.base.naturalId,
    config: x.config!,
    site: x.base.site,
  }));

  const days = fitDaysForShip(config.ship, sharingBases, armadaShip.cargoStore);
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

  const groups: UserData.MaterialGroupData[] = [];
  const cxBuyActions: UserData.ActionData[] = [];
  const offloads: StagedOffload[] = [];

  // Per-exchange aggregate of bills for bases with cxBuy on.
  const exchangeBills = new Map<string, Record<string, number>>();
  // Bases that actually stage (non-empty bill), in list order.
  const stagedBases: IncludedBase[] = [];

  for (const base of includedBases.value) {
    const { naturalId, planetName, site, config, armadaShip } = base;
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
      const code = armadaShip.exchangeCode;
      exchangeBills.set(code, mergeBills(exchangeBills.get(code), bill)!);
    }

    offloads.push({
      naturalId,
      planetName,
      config: { ...config },
      cargo: serializeStorage(armadaShip.cargoStore!),
      materials: { ...bill },
    });
  }

  if (offloads.length === 0) {
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

  for (const shipBases of multiShipGroups) {
    const firstNaturalId = shipBases[0]!.naturalId;
    for (let i = 0; i < shipBases.length; i++) {
      const base = shipBases[i]!;
      const isLast = i === shipBases.length - 1;
      mtraActions.push({
        type: 'MTRA',
        name: `Load ${base.naturalId}`,
        group: base.naturalId,
        origin: serializeStorage(base.armadaShip.warehouseStore!),
        dest: serializeStorage(base.armadaShip.cargoStore!),
        ...(isLast ? { sfcDestination: firstNaturalId } : { noSfc: true }),
      });
    }
  }

  for (const base of singleShipBases) {
    mtraActions.push({
      type: 'MTRA',
      name: `Load ${base.naturalId}`,
      group: base.naturalId,
      origin: serializeStorage(base.armadaShip.warehouseStore!),
      dest: serializeStorage(base.armadaShip.cargoStore!),
    });
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
    global: { name: 'Armada' },
    groups,
    actions: [refuelAction, ...cxBuyActions, ...mtraActions],
  };

  stagedArmada.value = {
    // Deep-clone to detach from tile-state reactivity.
    pkg: JSON.parse(JSON.stringify(pkg)),
    offloads,
  };
  showBuffer('XIT ARMADAACT');
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
      <PrunButton primary :data-tooltip="executeTooltip" @click="execute"> EXECUTE </PrunButton>
    </div>
    <div :class="$style.panes">
      <div :class="$style.left">
        <table :class="$style.table">
          <thead>
            <tr>
              <GripHeaderCell />
              <th :class="[$style.narrowCol, $style.centered]">Planet</th>
              <th :class="[$style.narrowCol, $style.centered]" colspan="2">Burn</th>
              <th :class="[$style.narrowCol, $style.centered]" colspan="2">Rep</th>
              <th :class="[$style.narrowCol, $style.centered]">Load</th>
              <th :class="[$style.narrowCol, $style.centered]">Assign</th>
            </tr>
          </thead>
          <tbody v-draggable="[orderedIds, dragOptions]">
            <PlanetRow
              v-for="id in orderedIds"
              :key="id"
              :site-id="rowById.get(id)!.base.siteId"
              :natural-id="rowById.get(id)!.base.naturalId"
              :planet-name="rowById.get(id)!.base.planetName"
              :config="rowById.get(id)!.config" />
          </tbody>
        </table>
      </div>
      <ShipPool :ships="cxShips" :base-configs="baseConfigs" />
      <div :class="$style.right">
        <table :class="$style.table">
          <thead>
            <tr>
              <th :class="[$style.narrowCol, $style.centered]">Fit</th>
              <th :class="[$style.narrowCol, $style.centered]">Materials</th>
              <th :class="[$style.narrowCol, $style.centered]">Days</th>
              <th :class="[$style.narrowCol, $style.centered]">Rep ≥</th>
              <th :class="[$style.narrowCol, $style.centered]">Adv</th>
              <th :class="[$style.narrowCol, $style.centered]">CX</th>
              <th :class="[$style.narrowCol, $style.centered]">Offload</th>
            </tr>
          </thead>
          <tbody>
            <AdvancedRow
              v-for="id in orderedIds"
              :key="id"
              :config="rowById.get(id)!.config"
              @fit="fitBase(rowById.get(id)!.base.naturalId)" />
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style module>
.layout {
  --armada-row-height: 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

.executeBar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: var(--armada-row-height);
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0 8px;
}

.panes {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  overflow: auto;
  flex: 1;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgb(51, 51, 51) transparent;
}

.panes::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.panes::-webkit-scrollbar-thumb {
  background-color: rgb(51, 51, 51);
  border-radius: 5px;
}

.left {
  flex: 0 0 auto;
  min-width: 0;
  overflow: visible;
}

.right {
  flex: 0 0 auto;
  padding: 0;
  overflow: visible;
}

.table {
  border-collapse: collapse;
}

.table thead tr {
  height: var(--armada-row-height);
  line-height: var(--armada-row-height);
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.table thead th {
  height: var(--armada-row-height);
  line-height: var(--armada-row-height);
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
