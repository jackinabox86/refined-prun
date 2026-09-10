<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { FLT_FUEL_HEADER_LABEL } from './defaults';

const emit = defineEmits<{ refuel: [] }>();
</script>

<template>
  <span :class="$style.container">
    <PrunButton dark inline :class="$style.button" @click.stop="emit('refuel')">
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

/* Keep header size/weight; leave Button__dark color (#666) and fill (#333). */
.container .button,
.container .button:hover,
.container .button:focus,
.container .button:active {
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-transform: none;
  cursor: pointer;
}
</style>
