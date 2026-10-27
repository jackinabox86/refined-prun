<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRouteAssign } from '@src/features/XIT/ROUTE/route-assign-run';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';

useMinBufferHeight();

// Taken once when the buffer opens, so the run cannot unmount itself.
const staged = stagedRouteAssign.value;
</script>

<template>
  <div v-if="staged === undefined">Nothing staged. Assign a route from XIT ROUTEBURN.</div>
  <div v-else-if="staged.shortLines !== undefined" :class="$style.short">
    <p>{{ staged.originLabel }} is short of this route's load. A base is not bought for.</p>
    <p v-for="line in staged.shortLines" :key="line.ticker">
      {{ line.ticker }}: have {{ line.free }} free, need {{ line.need }}
    </p>
  </div>
  <ExecuteActionPackage v-else :pkg="staged.pkg" :extra-steps="staged.steps" />
</template>

<style module>
.short {
  padding: 8px;
}
</style>
