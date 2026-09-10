<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { FLT_FUEL_HEADER_LABEL } from './defaults';

const emit = defineEmits<{ refuel: [] }>();
</script>

<template>
  <span :class="$style.container">
    <PrunButton :class="$style.button" @click.stop="emit('refuel')">
      {{ FLT_FUEL_HEADER_LABEL }}
    </PrunButton>
    <slot />
  </span>
</template>

<style module>
.container {
  display: flex;
  align-items: center;
  width: 100%;
  white-space: nowrap;
  gap: 6px;
}

/* Beat Button__btn so the label inherits Name / Cargo / Repair header text. */
.container .button,
.container .button:hover,
.container .button:focus,
.container .button:active {
  appearance: none;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  margin: 0;
  min-height: 0;
  min-width: 0;
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-transform: none;
  cursor: pointer;
}
</style>
