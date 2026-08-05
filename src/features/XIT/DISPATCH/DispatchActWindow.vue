<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedDispatch } from '@src/features/XIT/DISPATCH/staged';
</script>

<template>
  <div v-if="!stagedDispatch">Nothing staged. Open XIT DISPATCH and press EXECUTE.</div>
  <ExecuteActionPackage v-else :pkg="stagedDispatch.pkg" />
</template>
