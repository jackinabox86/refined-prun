<script setup lang="ts">
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { userData } from '@src/store/user-data';
import { canAcceptContract } from '@src/features/XIT/CONTS/utils';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { vDraggable } from 'vue-draggable-plus';
import { objectId } from '@src/utils/object-id';
import { prunStyleUpdated } from '@src/infrastructure/prun-ui/prun-css';

const { comPulse } = defineProps<{ comPulse?: boolean }>();

const pendingContracts = computed(
  () => contractsStore.all.value?.filter(canAcceptContract).length ?? 0,
);
const hasPendingContracts = computed(() => pendingContracts.value > 0);

const activeIndicator = [
  C.Frame.toggleIndicator,
  C.Frame.toggleIndicatorPulseActive,
  C.effects.shadowPulseSuccess,
];
const inactiveIndicator = [C.Frame.toggleIndicator, C.Frame.toggleIndicatorSecondary];

function indicatorClass(command: string) {
  if (command === 'COM' && comPulse) {
    return activeIndicator;
  }
  if (['CONTS', 'XIT CONTS'].includes(command) && hasPendingContracts.value) {
    return activeIndicator;
  }
  if (command === 'XIT DEV' && prunStyleUpdated.value) {
    return activeIndicator;
  }
  return inactiveIndicator;
}
</script>

<template>
  <div v-draggable="[userData.settings.sidebar, { animation: 150 }]" :class="$style.list">
    <div
      v-for="button in userData.settings.sidebar"
      :key="objectId(button)"
      :class="C.Frame.toggle"
      @click="() => showBuffer(button[1])">
      <span :class="[C.Frame.toggleLabel, C.fonts.fontRegular, C.type.typeRegular]">
        {{ button[0] }}
      </span>
      <div :class="indicatorClass(button[1])" />
    </div>
  </div>
</template>

<style module>
/* The game's toggle buttons are only rgba(255, 255, 255, 0.05) over a
   transparent box, so the rotated "APEX alpha" watermark that prun-bugs parks
   behind them still reads through. This wrapper is a direct child of the
   sidebar and exactly as wide, so `inherit` repaints the sidebar's own
   gradient as an opaque base that lines up pixel for pixel; the buttons keep
   their own tint on top and the list looks unchanged. */
.list {
  background: inherit;
}
</style>
