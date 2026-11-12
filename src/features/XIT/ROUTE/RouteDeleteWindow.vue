<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRouteDelete } from '@src/features/XIT/ROUTE/route-delete-run';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';

useMinBufferHeight();

// Taken once when the buffer opens, so the run cannot unmount itself.
const staged = stagedRouteDelete.value;
</script>

<template>
  <div v-if="staged === undefined">
    Nothing staged. Delete a linked route from XIT ROUTECONFIG or XIT ROUTEBURN.
  </div>
  <ExecuteActionPackage v-else :pkg="staged.pkg" :extra-steps="staged.steps" />
</template>
