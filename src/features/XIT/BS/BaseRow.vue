<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import InvBar from '@src/features/XIT/BS/InvBar.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';

const { siteId, naturalId, planetName, storeId } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));

const warehouse = computed(() => warehousesStore.getByEntityNaturalId(naturalId));
const warehouseStore = computed(() =>
  storagesStore
    .getByAddressableId(warehouse.value?.warehouseId)
    ?.find(x => x.type === 'WAREHOUSE_STORE'),
);
</script>

<template>
  <tr>
    <td :class="$style.planetCell">
      <PrunLink inline :command="`PLI ${naturalId}`" :class="$style.planetLink">{{
        planetName
      }}</PrunLink>
    </td>
    <td :class="$style.cmdCell">
      <PrunButton primary>CMDS&#x25B6;</PrunButton>
      <div :class="$style.expandedButtons">
        <PrunButton primary @click="showBuffer(`BBL ${naturalId}`)">BUILDINGS</PrunButton>
        <PrunButton primary @click="showBuffer(`BBC ${naturalId}`)">CONSTRUCT</PrunButton>
        <PrunButton primary @click="showBuffer(`WF ${naturalId}`)">WORKFORCE</PrunButton>
        <PrunButton primary @click="showBuffer(`EXP ${naturalId}`)">EXPERTS</PrunButton>
      </div>
    </td>
    <DaysCell
      v-if="days !== undefined"
      :days="days"
      :class="$style.burnCell"
      @click="showBuffer(`XIT BURN ${naturalId}`)" />
    <td v-else>-</td>
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
        :on-click-cmd="`WAR ${warehouse!.warehouseId}`" />
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
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
