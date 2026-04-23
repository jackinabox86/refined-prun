<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import InvBar from '@src/features/XIT/BS/InvBar.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { getPlanetProduction } from '@src/core/production';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';

const { siteId, naturalId, planetName, storeId, showBurn, showProd } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
  showBurn: boolean;
  showProd: boolean;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));

const production = computed(() => getPlanetProduction(siteId));
const prodTotals = computed(() => {
  const prod = production.value;
  if (!prod || prod.production.length === 0) {
    return undefined;
  }
  const orders = sumBy(prod.production, x => x.orders.length);
  const capacity = sumBy(prod.production, x => x.capacity);
  return { orders, capacity };
});
const prodClass = computed(() => {
  const totals = prodTotals.value;
  if (!totals) {
    return undefined;
  }
  return totals.orders < totals.capacity ? C.Workforces.daysMissing : C.Workforces.daysSupplied;
});

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
        <PrunButton primary @click="showBuffer(`BBL ${siteId}`)">BUILDINGS</PrunButton>
        <PrunButton primary @click="showBuffer(`BBC ${naturalId}`)">CONSTRUCT</PrunButton>
        <PrunButton primary @click="showBuffer(`WF ${siteId}`)">WORKFORCE</PrunButton>
        <PrunButton primary @click="showBuffer(`EXP ${siteId}`)">EXPERTS</PrunButton>
      </div>
    </td>
    <template v-if="showBurn">
      <DaysCell
        v-if="days !== undefined"
        :days="days"
        :class="$style.burnCell"
        @click="showBuffer(`XIT BURN ${naturalId}`)" />
      <td v-else>-</td>
    </template>
    <template v-if="showProd">
      <td v-if="prodTotals" :class="[prodClass, $style.prodCell]">
        <PrunButton dark inline @click="showBuffer(`XIT PROD ${naturalId}`)">PROD</PrunButton>
      </td>
      <td v-else>-</td>
    </template>
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
}

.prodCell {
  width: 0;
  white-space: nowrap;
  text-align: center;
}

.prodCell > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
