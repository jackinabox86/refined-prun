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
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { timestampEachMinute } from '@src/utils/dayjs';
import { store as planetContextMenu } from './planet-context-menu';

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
  const { threshold, offset } = userData.settings.repair;
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
    <td
      v-if="showBurn"
      :class="[$style.indicatorCell, $style.clickable, $style.sectionLeft, $style.sectionBottom]"
      @click="showBuffer(`XIT BURN ${naturalId}`)">
      <div :class="[$style.overlay, burnBgClass]" />
      <span :class="$style.indicatorText">{{ daysText ?? '-' }}</span>
    </td>
    <td
      v-if="showBurn"
      :class="[
        $style.buttonCell,
        $style.sectionBottom,
        !showProd && !showRepair && $style.sectionRight,
      ]">
      <PrunButton dark inline @click="showBuffer(`XIT BURNACT ${naturalId}`)">RES</PrunButton>
    </td>
    <td
      v-if="showProd"
      :class="[$style.indicatorCell, $style.clickable, $style.sectionLeft, $style.sectionBottom]"
      @click="showBuffer(`XIT PROD ${naturalId}`)">
      <div :class="[$style.overlay, prodBgClass]" />
      <span :class="$style.indicatorText">{{ prodText ?? '-' }}</span>
    </td>
    <td
      v-if="showProd"
      :class="[$style.buttonCell, $style.sectionBottom, !showRepair && $style.sectionRight]">
      <PrunButton dark inline @click="showBuffer(`XIT PROD ${naturalId}`)">PROD</PrunButton>
    </td>
    <td
      v-if="showRepair"
      :class="[$style.indicatorCell, $style.clickable, $style.sectionLeft, $style.sectionBottom]"
      @click="showBuffer(`XIT REP ${naturalId}`)">
      <div :class="[$style.overlay, repairBgClass]" />
      <span :class="$style.indicatorText">{{ repairDaysText ?? '-' }}</span>
    </td>
    <td v-if="showRepair" :class="[$style.buttonCell, $style.sectionBottom, $style.sectionRight]">
      <PrunButton dark inline @click="showBuffer(`XIT REPAIRACT ${naturalId}`)">REP</PrunButton>
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

.indicatorCell {
  position: relative;
  width: 0;
  white-space: nowrap;
  padding: 2px 4px;
  text-align: center;
}

.overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.indicatorText {
  position: relative;
  display: inline-block;
  min-width: 3ch;
}

.buttonCell {
  width: 0;
  white-space: nowrap;
  padding: 2px 4px;
}

.clickable {
  cursor: pointer;
}

.sectionLeft {
  border-left: 1px solid #ffc856;
}

.sectionRight {
  border-right: 1px solid #ffc856;
}

.sectionBottom {
  border-bottom: 1px solid #ffc856;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
