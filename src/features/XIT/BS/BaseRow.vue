<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import InvBar from '@src/features/XIT/BS/InvBar.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { userData } from '@src/store/user-data';

const { siteId, naturalId, planetName, storeId, showBurn } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
  showBurn: boolean;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));

const burnBgClass = computed(() => {
  if (days.value === undefined) return {};
  const d = Math.floor(days.value);
  return {
    [C.Workforces.daysMissing]: d <= userData.settings.burn.red,
    [C.Workforces.daysWarning]: d <= userData.settings.burn.yellow,
    [C.Workforces.daysSupplied]: d > userData.settings.burn.yellow,
  };
});

const daysText = computed(() => {
  if (days.value === undefined) return undefined;
  const d = Math.floor(days.value);
  return d < 500 ? String(d) : '∞';
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

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
