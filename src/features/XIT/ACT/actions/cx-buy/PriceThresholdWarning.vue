<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Passive from '@src/components/forms/Passive.vue';
import Commands from '@src/components/forms/Commands.vue';
import { fixed02, percent1 } from '@src/utils/format';
import { priceExcessPercent, type PriceThresholdLevel } from './price-threshold';

const { ticker, price, refinedValue, level } = defineProps<{
  ticker: string;
  price: number;
  refinedValue: number;
  level: Exclude<PriceThresholdLevel, 'none'>;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const excessRatio = computed(() => {
  const excess = priceExcessPercent(price, refinedValue);
  return excess === undefined ? undefined : excess / 100;
});

const toneClass = computed(() =>
  level === 'red' ? C.Workforces.daysMissing : C.Workforces.daysWarning,
);
</script>

<template>
  <div :class="C.DraftConditionEditor.form">
    <SectionHeader>
      <span :class="toneClass">{{ level === 'red' ? 'Red' : 'Yellow' }} price warning</span>
    </SectionHeader>
    <Passive :label="ticker">
      CX {{ fixed02(price) }} vs refined-PrUn {{ fixed02(refinedValue)
      }}<template v-if="excessRatio !== undefined"> ({{ percent1(excessRatio) }} over)</template>
    </Passive>
    <Commands>
      <PrunButton primary @click="emit('close')">DISMISS</PrunButton>
    </Commands>
  </div>
</template>
