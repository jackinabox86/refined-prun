<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const { naturalId, planetName, storeId } = defineProps<{
  naturalId: string;
  planetName: string;
  storeId: string;
}>();
</script>

<template>
  <tr>
    <td>
      <PrunLink inline :command="`PLI ${naturalId}`">{{ planetName }}</PrunLink>
    </td>
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
</style>
