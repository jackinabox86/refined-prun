<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { agentReadyPackages } from '@src/features/XIT/ACT/agent-sync';
import { AGENT_DONE } from '@src/features/XIT/ACT/action-steps/AGENT_DONE';

const parameters = useXitParameters();
const messageId = parameters.join(' ');

const entry = computed(() => agentReadyPackages.value.find(x => x.messageId === messageId));

const extraSteps = computed(() => {
  const id = entry.value?.id;
  if (!id) {
    return undefined;
  }
  return [AGENT_DONE({ id })];
});
</script>

<template>
  <div v-if="!entry"> Package "{{ messageId }}" not found. Refresh XIT AGENT and try again. </div>
  <ExecuteActionPackage v-else :pkg="entry.pkg" :extra-steps="extraSteps" />
</template>
