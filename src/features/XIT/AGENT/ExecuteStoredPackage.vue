<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { agentReadyPackages } from '@src/features/XIT/ACT/agent-sync';

const parameters = useXitParameters();
const messageId = parameters.join(' ');

const entry = computed(() => agentReadyPackages.value.find(x => x.messageId === messageId));
</script>

<template>
  <div v-if="!entry"> Package "{{ messageId }}" not found. Refresh XIT AGENT and try again. </div>
  <ExecuteActionPackage v-else :pkg="entry.pkg" />
</template>
