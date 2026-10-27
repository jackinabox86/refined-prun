<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import {
  finishShipPick,
  shipPickPending,
  shipPickPrompt,
} from '@src/features/XIT/ROUTE/route-ship-pick';

const ships = shipPickPending();
const prompt = shipPickPrompt();
</script>

<template>
  <div :class="$style.root">
    <template v-if="ships !== undefined && ships.length === 0">
      <p>None of your ships can carry this route's load.</p>
      <PrunButton dark @click="finishShipPick(undefined)">Cancel</PrunButton>
    </template>
    <p v-else-if="ships === undefined">No ship is waiting to be picked.</p>
    <template v-else>
      <p>{{ prompt }}</p>
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
