<script setup lang="ts">
import NumberInput from '@src/components/forms/NumberInput.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import PrunButton from '@src/components/PrunButton.vue';
import type { MaterialFilter } from '@src/features/XIT/ACT/material-groups/resupply/config';
import type { ArmadaBaseConfig } from '@src/features/XIT/ARMADA/utils';

const { config } = defineProps<{
  config: ArmadaBaseConfig;
}>();

const emit = defineEmits<{
  fit: [];
}>();

const materialFilterOptions: MaterialFilter[] = ['All', 'Workforce', 'Production'];

const canFit = computed(() => !!config.ship);
</script>

<template>
  <tr :class="$style.row">
    <td :class="$style.fitCell">
      <PrunButton dark inline :disabled="!canFit" @click="emit('fit')">FIT</PrunButton>
    </td>
    <td :class="$style.selectCell">
      <div :class="[C.forms.input, $style.selectWrap]">
        <SelectInput v-model="config.materialFilter" :options="materialFilterOptions" />
      </div>
    </td>
    <td :class="$style.inputCell">
      <NumberInput v-model="config.days" :class="$style.faintInput" />
    </td>
    <td :class="$style.inputCell">
      <NumberInput v-model="config.repThreshold" :class="$style.faintInput" />
    </td>
    <td :class="$style.inputCell">
      <NumberInput v-model="config.repAdvance" :class="$style.faintInput" />
    </td>
    <td :class="$style.toggleCell">
      <RadioItem v-model="config.cxBuy" horizontal>BUY</RadioItem>
    </td>
    <td :class="$style.toggleCell">
      <RadioItem v-model="config.offloadJson" horizontal>JSON</RadioItem>
    </td>
  </tr>
</template>

<style module>
.row {
  height: 24px;
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.inputCell {
  width: 0;
  white-space: nowrap;
  padding: 0 2px;
  line-height: 22px;
  vertical-align: middle;
}

.faintInput {
  width: 48px;
}

.faintInput :global(input) {
  width: 48px;
  height: 17px;
  background-color: transparent;
  border-width: 0 0 1px;
  border-bottom: 1px solid transparent;
  color: #888;
  padding: 0 4px;
  box-sizing: border-box;
}

.faintInput :global(input:focus) {
  outline: none;
  color: #ccc;
  border-bottom-color: #666;
}

.selectCell {
  width: 0;
  white-space: nowrap;
  padding: 0 2px;
  line-height: 22px;
  vertical-align: middle;
}

.selectWrap {
  width: 90px;
}

.selectWrap > * {
  width: 90px !important;
  margin: 0 !important;
}

.selectWrap :global(select) {
  width: 100%;
}

.toggleCell {
  width: 0;
  white-space: nowrap;
  padding: 0 2px;
  vertical-align: middle;
  text-align: center;
}

.fitCell {
  width: 0;
  white-space: nowrap;
  padding: 0 4px;
  line-height: 22px;
  vertical-align: middle;
}
</style>
