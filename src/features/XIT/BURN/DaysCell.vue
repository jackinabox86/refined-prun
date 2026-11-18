<script setup lang="ts">
import { burnDaysClass, formatBurnDays } from '@src/features/XIT/BURN/utils';
import {
  EN_ROUTE_BLUE,
  EN_ROUTE_BLUE_BG,
  EN_ROUTE_ROCKET,
} from '@src/features/XIT/ROUTE/automated-route-bases';
import fa from '@src/utils/font-awesome.module.css';

const { days, enRoute = false } = defineProps<{ days: number; enRoute?: boolean }>();

const formattedDays = computed(() => formatBurnDays(days));

const burnClass = computed(() => (enRoute ? undefined : burnDaysClass(days)));

const overlayStyle = computed(() =>
  enRoute
    ? {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        backgroundColor: EN_ROUTE_BLUE_BG,
      }
    : { position: 'absolute' as const, left: 0, top: 0, width: '100%', height: '100%' },
);
</script>

<template>
  <td :style="{ position: 'relative' }">
    <div :style="overlayStyle" :class="burnClass" />
    <span v-if="enRoute" :class="fa.solid" :style="{ color: EN_ROUTE_BLUE }">{{
      EN_ROUTE_ROCKET
    }}</span>
    <span v-else>{{ formattedDays }}</span>
  </td>
</template>
