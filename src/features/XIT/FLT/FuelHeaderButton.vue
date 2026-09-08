<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { FLT_FUEL_HEADER_LABEL } from './defaults';

const emit = defineEmits<{ refuel: [] }>();
</script>

<template>
  <span :class="$style.container">
    <PrunButton
      dark
      inline
      :class="[$style.button, C.fonts.fontRegular, C.type.typeRegular]"
      @click.stop="emit('refuel')">
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

.button {
  font-size: 12px;
}
</style>
