<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedLowstrife } from '@src/features/XIT/LOWSTRIFE/staged';
</script>

<template>
  <div v-if="!stagedLowstrife">Nothing staged. Open XIT LOWSTRIFE and press EXECUTE.</div>
  <ExecuteActionPackage v-else :pkg="stagedLowstrife" />
</template>
