<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedGovBurn } from '@src/features/XIT/GOVBURN/staged';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';

useMinBufferHeight();
</script>

<template>
  <div v-if="!stagedGovBurn">Nothing staged. Open XIT GOVBURNACT and press EXECUTE.</div>
  <ExecuteActionPackage v-else :pkg="stagedGovBurn.pkg" />
</template>
