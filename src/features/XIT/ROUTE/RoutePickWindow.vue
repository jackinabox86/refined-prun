<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { finishShipPick, shipPickPending } from '@src/features/XIT/ROUTE/route-ship-pick';

const ships = shipPickPending();
</script>

<template>
  <div :class="$style.root">
    <p v-if="ships === undefined || ships.length === 0">No ship is waiting to be picked.</p>
    <template v-else>
      <p>The saved ship is not free. Pick one that fits this route.</p>
      <div :class="$style.list">
        <PrunButton
          v-for="ship in ships"
          :key="ship.label"
          primary
          @click="finishShipPick(ship.label)">
          {{ ship.label }}
        </PrunButton>
      </div>
      <PrunButton dark @click="finishShipPick(undefined)">Cancel</PrunButton>
    </template>
  </div>
</template>

<style module>
.root {
  padding: 8px;
}

.list {
  display: flex;
  flex-direction: column;
  row-gap: 0.25rem;
  margin-bottom: 0.5rem;
}
</style>
