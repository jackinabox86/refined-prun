<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRoute } from '@src/features/XIT/ROUTE/staged';

const pkg = stagedRoute.value;

function keepOpenOnComplete() {
  return true;
}
</script>

<template>
  <ExecuteActionPackage v-if="pkg" :pkg="pkg" :keep-open-on-complete="keepOpenOnComplete" />
  <p v-else>Stage a route with XIT ROUTE.</p>
</template>
