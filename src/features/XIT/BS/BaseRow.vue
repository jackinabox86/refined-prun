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
    <td>
      <PrunLink inline :command="`PLI ${naturalId}`">{{ planetName }}</PrunLink>
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
    <td>
      <div :class="$style.buttons">
        <PrunButton dark inline @click="showBuffer(`BBC ${naturalId}`)">BBC</PrunButton>
        <PrunButton dark inline @click="showBuffer(`BBL ${naturalId}`)">BBL</PrunButton>
      </div>
    </td>
  </tr>
</template>

<style module>
.buttons {
  display: flex;
  flex-direction: row;
  column-gap: 0.25rem;
}

.burnCell {
  cursor: pointer;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
