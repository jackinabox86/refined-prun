<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import InvBar from '@src/features/XIT/BS/InvBar.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { getPlanetProduction } from '@src/core/production';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { userData } from '@src/store/user-data';
import { getRepairOffset, getRepairThreshold } from '@src/core/buildings';
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { timestampEachMinute } from '@src/utils/dayjs';
import { findShipsAtNaturalId } from '@src/core/ships';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { store as planetContextMenu } from '../planet-context-menu';

const {
  siteId,
  naturalId,
  planetName,
  storeId,
  showCmds,
  showBurn,
  showProd,
  showRepair,
  showInv,
  showWar,
  showShips,
} = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
  showCmds: boolean;
  showBurn: boolean;
  showProd: boolean;
  showRepair: boolean;
  showInv: boolean;
  showWar: boolean;
  showShips: boolean;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));

const burnBgClass = computed(() => {
  if (days.value === undefined) {
    return {};
  }
  const d = Math.floor(days.value);
  return {
    [C.Workforces.daysMissing]: d <= userData.settings.burn.red,
    [C.Workforces.daysWarning]: d <= userData.settings.burn.yellow,
    [C.Workforces.daysSupplied]: d > userData.settings.burn.yellow,
  };
});

const daysText = computed(() => {
  if (days.value === undefined) {
    return undefined;
  }
  const d = Math.floor(days.value);
  return d < 500 ? String(d) : '∞';
});

const production = computed(() => getPlanetProduction(siteId));
const prodTotals = computed(() => {
  const prod = production.value;
  if (!prod || prod.production.length === 0) {
    return undefined;
  }
  return {
    orders: sumBy(prod.production, x => x.orders.length),
    capacity: sumBy(prod.production, x => x.capacity),
  };
});
const prodBgClass = computed(() => {
  const totals = prodTotals.value;
  if (!totals) {
    return {};
  }
  return {
    [C.Workforces.daysMissing]: totals.orders < totals.capacity,
    [C.Workforces.daysSupplied]: totals.orders >= totals.capacity,
  };
});

const prodText = computed(() => {
  const totals = prodTotals.value;
  if (!totals) {
    return undefined;
  }
  return totals.orders >= totals.capacity ? '✓' : '∅';
});

const repairAge = computed(() => getPlanetRepairAge(siteId, timestampEachMinute.value));

const repairBgClass = computed(() => {
  const age = repairAge.value;
  if (age === undefined) {
    return {};
  }
  const threshold = getRepairThreshold(naturalId);
  const offset = getRepairOffset(naturalId);
  const d = Math.floor(age);
  return {
    [C.Workforces.daysMissing]: d >= threshold,
    [C.Workforces.daysWarning]: d >= threshold - offset,
    [C.Workforces.daysSupplied]: d < threshold - offset,
  };
});

const repairDaysText = computed(() => {
  const age = repairAge.value;
  if (age === undefined) {
    return undefined;
  }
  return String(Math.floor(age));
});

const warehouse = computed(() => warehousesStore.getByEntityNaturalId(naturalId));
const warehouseStore = computed(() =>
  storagesStore
    .getByAddressableId(warehouse.value?.warehouseId)
    ?.find(x => x.type === 'WAREHOUSE_STORE'),
);

interface ShipEntry {
  ship: PrunApi.Ship;
  displayName: string;
  truncatedName: string;
  arrived: boolean;
}

const shipEntries = computed<ShipEntry[]>(() => {
  const ships = findShipsAtNaturalId(naturalId);
  if (!ships || ships.length === 0) {
    return [];
  }
  const entries = ships.map<ShipEntry>(ship => {
    const displayName = ship.name || ship.registration;
    return {
      ship,
      displayName,
      truncatedName: displayName.length > 10 ? displayName.slice(0, 10) : displayName,
      arrived: !ship.flightId,
    };
  });
  entries.sort((a, b) => {
    if (a.arrived !== b.arrived) {
      return a.arrived ? -1 : 1;
    }
    if (a.arrived) {
      return a.displayName.localeCompare(b.displayName);
    }
    const arrivalA = flightsStore.getById(a.ship.flightId)?.arrival.timestamp ?? Infinity;
    const arrivalB = flightsStore.getById(b.ship.flightId)?.arrival.timestamp ?? Infinity;
    return arrivalA - arrivalB;
  });
  return entries;
});
</script>

<template>
  <tr :class="$style.row">
    <td
      :class="$style.planetCell"
      @contextmenu.prevent="planetContextMenu.showMenu($event, naturalId)">
      <PrunLink inline :command="`BS ${naturalId}`" :class="$style.planetLink">{{
        planetName
      }}</PrunLink>
    </td>
    <td v-if="showCmds" :class="$style.cmdCell">
      <PrunButton dark inline>CMDS&#x25B6;</PrunButton>
      <div :class="$style.rowOverlay" />
      <div :class="$style.expandedButtons">
        <PrunButton dark inline @click="showBuffer(`BBL ${siteId}`)">BUILDINGS</PrunButton>
        <PrunButton dark inline @click="showBuffer(`BBC ${naturalId}`)">CONSTRUCT</PrunButton>
        <PrunButton dark inline @click="showBuffer(`WF ${siteId}`)">WORKFORCE</PrunButton>
        <PrunButton dark inline @click="showBuffer(`EXP ${siteId}`)">EXPERTS</PrunButton>
      </div>
    </td>
    <td v-if="showBurn" :class="$style.statusCell">
      <div :class="[$style.statusContent, burnBgClass]">
        <span :class="$style.statusNum" @click="showBuffer(`XIT BURN ${naturalId}`)">{{
          daysText ?? '-'
        }}</span>
        <PrunButton dark inline @click="showBuffer(`XIT BURNACT ${naturalId}`)">RES</PrunButton>
      </div>
    </td>
    <td v-if="showProd" :class="$style.statusCell">
      <div :class="[$style.statusContent, prodBgClass]">
        <span :class="$style.statusNum" @click="showBuffer(`XIT PROD ${naturalId}`)">{{
          prodText ?? '-'
        }}</span>
        <PrunButton dark inline @click="showBuffer(`XIT PROD ${naturalId}`)">PROD</PrunButton>
      </div>
    </td>
    <td v-if="showRepair" :class="$style.statusCell">
      <div :class="[$style.statusContent, repairBgClass]">
        <span :class="$style.statusNum" @click="showBuffer(`XIT REP ${naturalId}`)">{{
          repairDaysText ?? '-'
        }}</span>
        <PrunButton dark inline @click="showBuffer(`XIT REPAIRACT ${naturalId}`)">REP</PrunButton>
      </div>
    </td>
    <td v-if="showInv" :class="$style.invCell">
      <InvBar
        :store-id="storeId"
        :natural-id="naturalId"
        :on-click-cmd="`INV ${storeId.substring(0, 8)}`" />
    </td>
    <td v-if="showWar" :class="$style.invCell">
      <InvBar
        v-if="warehouseStore"
        :store-id="warehouseStore.id"
        :on-click-cmd="`WAR ${naturalId}`" />
    </td>
    <td v-if="showShips" :class="$style.shipsCell">
      <span v-for="entry in shipEntries" :key="entry.ship.id" :class="$style.shipBlock">
        <span :class="$style.shipInvBar">
          <InvBar
            :store-id="entry.ship.idShipStore"
            :on-click-cmd="`SHPI ${entry.ship.registration}`" />
        </span>
        <span
          :class="[C.Link.link, $style.shipName, { [$style.shipNameFlying]: !entry.arrived }]"
          :style="entry.arrived ? { color: '#f7a600' } : undefined"
          @click="showBuffer(`SHPI ${entry.ship.registration}`)">
          {{ entry.truncatedName }}
        </span>
      </span>
    </td>
  </tr>
</template>

<style module>
.planetCell {
  max-width: 30ch;
  font-weight: bold;
  font-size: 12px;
}

.planetLink {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
}

.cmdCell {
  position: relative;
  overflow: visible;
  white-space: nowrap;
  width: 0;
}

.rowOverlay {
  display: none;
  position: absolute;
  top: 0;
  left: -500px;
  right: -500px;
  height: 100%;
  background: black;
  z-index: 9;
}

.cmdCell:hover .rowOverlay {
  display: block;
}

.expandedButtons {
  display: none;
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
  padding: 0 4px;
  white-space: nowrap;
}

.cmdCell:hover .expandedButtons {
  display: flex;
}

.row {
  border-bottom: 1px solid #2b485a;
}

.statusCell {
  width: 0;
  white-space: nowrap;
  padding: 2px;
  text-align: center;
}

.statusContent {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  vertical-align: middle;
  padding: 2px 4px;
}

.statusNum {
  min-width: 3ch;
  text-align: center;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}

.shipsCell {
  padding: 2px 6px;
  vertical-align: middle;
  white-space: nowrap;
}

.shipBlock {
  position: relative;
  display: inline-block;
  height: 13px;
  vertical-align: middle;
  margin-right: 4px;
}

.shipBlock:last-child {
  margin-right: 0;
}

.shipInvBar {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 13px;
  z-index: 0;
}

.shipName {
  position: relative;
  z-index: 1;
  cursor: pointer;
  font-size: 11px;
  font-weight: bold;
  line-height: 13px;
  padding: 0 3px;
  white-space: nowrap;
}

.shipNameFlying {
  font-style: italic;
}
</style>
