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

const { siteId, naturalId, planetName, storeId, showBurn, showProd, showRepair } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
  showBurn: boolean;
  showProd: boolean;
  showRepair: boolean;
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

const repairAge = computed(() => getPlanetRepairAge(siteId, timestampEachMinute.value));

const repairBgClass = computed(() => {
  const age = repairAge.value;
  if (age === undefined) return {};
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
  if (age === undefined) return undefined;
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
    <td :class="$style.planetCell">
      <PrunLink inline :command="`BS ${naturalId}`" :class="$style.planetLink">{{
        planetName
      }}</PrunLink>
    </td>
    <td :class="$style.cmdCell">
      <PrunButton primary>CMDS&#x25B6;</PrunButton>
      <div :class="$style.expandedButtons">
        <PrunButton primary @click="showBuffer(`BBL ${siteId}`)">BUILDINGS</PrunButton>
        <PrunButton primary @click="showBuffer(`BBC ${naturalId}`)">CONSTRUCT</PrunButton>
        <PrunButton primary @click="showBuffer(`WF ${siteId}`)">WORKFORCE</PrunButton>
        <PrunButton primary @click="showBuffer(`EXP ${siteId}`)">EXPERTS</PrunButton>
      </div>
    </td>
    <td
      v-if="showBurn"
      :style="{ position: 'relative' }"
      :class="$style.burnCell"
      @click="showBuffer(`XIT BURN ${naturalId}`)">
      <div
        v-if="daysText !== undefined"
        :style="{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }"
        :class="burnBgClass" />
      <div :class="$style.burnContent">
        <PrunButton dark inline @click.stop="showBuffer(`XIT BURNACT ${naturalId}`)">
          RESUPPLY
        </PrunButton>
        <span :class="$style.daysNum">{{ daysText ?? '-' }}</span>
      </div>
    </td>
    <td v-if="showProd" :style="{ position: 'relative' }" :class="$style.prodCell">
      <template v-if="prodTotals">
        <div
          :style="{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }"
          :class="prodBgClass" />
        <div :class="$style.prodContent">
          <PrunButton dark inline @click="showBuffer(`XIT PROD ${naturalId}`)">PROD</PrunButton>
        </div>
      </template>
      <span v-else>-</span>
    </td>
    <td
      v-if="showRepair"
      :style="{ position: 'relative' }"
      :class="$style.repairCell"
      @click="showBuffer(`XIT REP ${naturalId}`)">
      <div
        v-if="repairDaysText !== undefined"
        :style="{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }"
        :class="repairBgClass" />
      <div :class="$style.repairContent">
        <PrunButton dark inline @click.stop="showBuffer(`XIT REPAIRACT ${naturalId}`)">
          REP
        </PrunButton>
        <span :class="$style.daysNum">{{ repairDaysText ?? '-' }}</span>
      </div>
    </td>
    <td :class="$style.invCell">
      <InvBar
        :store-id="storeId"
        :natural-id="naturalId"
        :on-click-cmd="`INV ${storeId.substring(0, 8)}`" />
    </td>
    <td :class="$style.invCell">
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
}

.planetLink {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cmdCell {
  position: relative;
  overflow: visible;
  white-space: nowrap;
  width: 0;
}

.expandedButtons {
  display: none;
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: #23282b;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
  padding: 0 4px;
  white-space: nowrap;
}

.cmdCell:hover .expandedButtons {
  display: flex;
}

.burnCell {
  cursor: pointer;
  width: 0;
  white-space: nowrap;
  padding: 2px 4px;
  border-left: 2px solid #3fa2de;
  border-right: 2px solid #3fa2de;
}

.row {
  border-bottom: 1px solid #2b485a;
}

.burnContent {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.daysNum {
  display: inline-block;
  min-width: 3ch;
  text-align: right;
}

.prodCell {
  width: 0;
  white-space: nowrap;
  padding: 2px 4px;
  text-align: center;
}

.prodContent {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.repairCell {
  cursor: pointer;
  width: 0;
  white-space: nowrap;
  padding: 2px 4px;
  border-left: 2px solid #3fa2de;
  border-right: 2px solid #3fa2de;
}

.repairContent {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
