<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Passive from '@src/components/forms/Passive.vue';
import Commands from '@src/components/forms/Commands.vue';
import { fixed0 } from '@src/utils/format';
import type { RouteStockDraw } from '@src/features/XIT/ROUTE/route-reserve';

const { exchange, draws } = defineProps<{
  exchange: string;
  draws: RouteStockDraw[];
}>();

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div :class="C.DraftConditionEditor.form">
    <SectionHeader>Route Stock Warning</SectionHeader>
    <Passive v-for="draw in draws" :key="draw.ticker" :label="draw.ticker">
      Leaves {{ fixed0(draw.left) }} on {{ exchange }},
      <span :class="C.Workforces.daysMissing">{{ fixed0(draw.held) }} held for routes</span>
    </Passive>
    <Commands>
      <PrunButton primary @click="emit('close')">DISMISS</PrunButton>
    </Commands>
  </div>
</template>
