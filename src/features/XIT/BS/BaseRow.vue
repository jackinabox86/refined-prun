<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';

const { siteId, naturalId, planetName, storeId } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));
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
    <td>
      <div :class="$style.buttons">
        <PrunButton dark inline @click="showBuffer(`BBC ${naturalId}`)">BBC</PrunButton>
        <PrunButton dark inline @click="showBuffer(`INV ${storeId.substring(0, 8)}`)">INV</PrunButton>
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
</style>
