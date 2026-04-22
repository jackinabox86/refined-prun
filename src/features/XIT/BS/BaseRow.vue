<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
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
    <td :class="$style.cmdCell">
      <div :class="$style.trigger">CMDS&#x25B6;</div>
      <div :class="$style.expandedButtons">
        <button :class="$style.yellowBtn" @click="showBuffer(`BBL ${naturalId}`)">
          Buildings
        </button>
        <button :class="$style.yellowBtn" @click="showBuffer(`BBC ${naturalId}`)">
          Construct
        </button>
        <button :class="$style.yellowBtn" @click="showBuffer(`WF ${naturalId}`)">
          Workforce
        </button>
        <button :class="$style.yellowBtn" @click="showBuffer(`EXP ${naturalId}`)"> Experts </button>
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
.cmdCell {
  position: relative;
  overflow: visible;
  white-space: nowrap;
}

.trigger {
  display: inline-block;
  border: 1px solid #f7a600;
  color: #f7a600;
  padding: 1px 5px;
  font-size: 11px;
  cursor: default;
  white-space: nowrap;
}

.expandedButtons {
  display: none;
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
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

.yellowBtn {
  background-color: transparent;
  border: 1px solid #f7a600;
  color: #f7a600;
  cursor: pointer;
  padding: 1px 5px;
  font-size: 11px;
  font-family: inherit;
  white-space: nowrap;

  &:hover {
    background-color: #f7a600;
    color: #000;
  }
}

.burnCell {
  cursor: pointer;
}

.invCell {
  min-width: 60px;
  padding: 2px;
}
</style>
