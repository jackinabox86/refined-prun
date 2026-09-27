<script setup lang="ts">
import SectionHeader from '@src/components/SectionHeader.vue';
import {
  DEFAULT_FLT_BUTTON_COLORS,
  FLT_BUTTON_COLOR_OPTIONS,
  FLT_BUTTON_COLOR_STATUSES,
  setFltButtonColor,
  type FltButtonColorStatus,
} from './button-colors';
import { userData } from '@src/store/user-data';

const colors = computed(() => userData.settings.fltButtonColors ?? DEFAULT_FLT_BUTTON_COLORS);

function onColorChange(status: FltButtonColorStatus, event: Event) {
  const select = event.target as HTMLSelectElement;
  setFltButtonColor(status, select.value);
}

function optionLabel(value: string) {
  return FLT_BUTTON_COLOR_OPTIONS.find(x => x.value === value)?.label ?? value;
}
</script>

<template>
  <SectionHeader>Unload Button Colors</SectionHeader>
  <div :class="$style.grid">
    <div :class="$style.corner" />
    <div :class="$style.colHeader">Empty</div>
    <div :class="$style.colHeader">Cargo</div>

    <template v-for="row in ['Base', 'CX']" :key="row">
      <div :class="$style.rowHeader">{{ row }}</div>
      <div
        v-for="status in FLT_BUTTON_COLOR_STATUSES.filter(x => x.location === row)"
        :key="status.key"
        :class="$style.cell">
        <span
          :class="$style.swatch"
          :style="{ backgroundColor: colors[status.key] }"
          :data-tooltip="optionLabel(colors[status.key])" />
        <select
          :class="$style.select"
          :value="colors[status.key]"
          @change="onColorChange(status.key, $event)">
          <option
            v-for="option in FLT_BUTTON_COLOR_OPTIONS"
            :key="option.value"
            :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </template>
  </div>
</template>

<style module>
.grid {
  display: grid;
  grid-template-columns: 52px 1fr 1fr;
  gap: 8px;
  padding: 10px;
  align-items: center;
}

.corner {
  min-height: 1px;
}

.colHeader,
.rowHeader {
  color: #bbb;
  font-size: 12px;
  text-transform: uppercase;
}

.colHeader {
  text-align: center;
}

.cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.swatch {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border: 1px solid #555;
}

.select {
  flex: 1 1 auto;
  min-width: 0;
  background: #26353e;
  color: #ddd;
  border: 1px solid #3a4a54;
  padding: 2px 4px;
  font-size: 12px;
}
</style>
