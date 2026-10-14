<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRoute } from '@src/features/XIT/TRANSITS/staged';

const pkg = stagedRoute.value;
</script>

<template>
  <ExecuteActionPackage v-if="pkg" :pkg="pkg" auto-start hide-preview close-when-done />
  <p v-else>Stage a route with XIT TRANSITS.</p>
</template>
