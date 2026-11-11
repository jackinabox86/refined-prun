<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRtRoute } from '@src/features/XIT/RTACT/staged';
import { isRtHost, PRODUCTION_HOST } from '@src/features/XIT/RTACT/rt-host';

const rtHost = isRtHost(location.hostname);
</script>

<template>
  <div v-if="!rtHost">This runner only runs on {{ PRODUCTION_HOST }}.</div>
  <div v-else-if="!stagedRtRoute">Nothing staged. Open XIT RTACT and press Run.</div>
  <ExecuteActionPackage v-else :pkg="stagedRtRoute.pkg" />
</template>
