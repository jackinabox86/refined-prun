<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { originRows } from '@src/features/XIT/ROUTE/route-origins';
import { restockPackage } from '@src/features/XIT/ROUTE/restock-package';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';

useMinBufferHeight();

// Taken once when the buffer opens, so the package does not change under a run.
const origins = originRows(Date.now())
  .filter(row => row.kind === 'cx')
  .map(row => ({ exchange: row.id, materials: row.restock }));
const pkg = restockPackage(origins);
</script>

<template>
  <div v-if="pkg.actions.length === 0">
    No exchange origin has a running route lap within the resupply days.
  </div>
  <ExecuteActionPackage v-else :pkg="pkg" />
</template>
