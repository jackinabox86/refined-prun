<script setup lang="ts">
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import PrunButton from '@src/components/PrunButton.vue';
import { PlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { isOnAutomatedRoute } from '@src/features/XIT/ROUTE/automated-route-bases';
import { store as planetContextMenu } from '@src/features/XIT/planet-context-menu';
import { useTileState } from '@src/features/XIT/BURN/tile-state';

const { burn } = defineProps<{
  burn: PlanetBurn;
  hasMinimize?: boolean;
  minimized?: boolean;
  onClick: () => void;
}>();

const io = useTileState('io');
const days = computed(() => countDays(burn.burn));
const enRoute = computed(() => burn.naturalId !== '' && isOnAutomatedRoute(burn.naturalId));
const nameColspan = computed(() => (io.value ? 6 : 4));
</script>

<template>
  <tr :class="$style.row">
    <td
      :colspan="nameColspan"
      :class="$style.cell"
      @click="onClick"
      @contextmenu.prevent="burn.naturalId && planetContextMenu.showMenu($event, burn.naturalId)">
      <span v-if="hasMinimize" :class="$style.minimize">
        {{ minimized ? '+' : '-' }}
      </span>
      <span>{{ burn.planetName }}</span>
    </td>
    <DaysCell :days="days" :en-route="enRoute" />
    <td>
      <div :class="$style.buttons">
        <PrunButton dark inline @click="showBuffer(`BS ${burn.naturalId}`)">BS</PrunButton>
        <PrunButton dark inline @click="showBuffer(`INV ${burn.storeId.substring(0, 8)}`)">
          INV
        </PrunButton>
        <PrunButton dark inline @click="showBuffer(`XIT BURNACT ${burn.naturalId}`)"
          >ACT</PrunButton
        >
      </div>
    </td>
  </tr>
</template>

<style module>
.row {
  border-bottom: 1px solid #2b485a;
}

.cell {
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}

.minimize {
  display: inline-block;
  width: 26px;
  text-align: center;
}

.buttons {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 0.25rem;
}
</style>
