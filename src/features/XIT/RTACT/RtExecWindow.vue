<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedRtRoute } from '@src/features/XIT/RTACT/staged';
import { isStagingHost, STAGING_HOST } from '@src/features/XIT/RTACT/staging-host';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';

useMinBufferHeight();
const staging = isStagingHost(location.hostname);
</script>

<template>
  <div v-if="!staging">This runner only runs on {{ STAGING_HOST }}.</div>
  <div v-else-if="!stagedRtRoute">Nothing staged. Open XIT RTACT and press Run.</div>
  <ExecuteActionPackage v-else :pkg="stagedRtRoute.pkg" />
</template>
