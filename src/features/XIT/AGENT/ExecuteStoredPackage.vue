<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { agentReadyPackages, parseChainId } from '@src/features/XIT/ACT/agent-sync';
import { AGENT_DONE } from '@src/features/XIT/ACT/action-steps/AGENT_DONE';
import { OPEN_SFC } from '@src/features/XIT/ACT/action-steps/OPEN_SFC';
import { deserializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';

const parameters = useXitParameters();
const messageId = parameters.join(' ');

// Snapshot once: AGENT_DONE posts a completion marker mid-run, which drops this
// message from agentReadyPackages (meant to hide it from AGENT next time, not kill
// the run in progress). A live computed here would flip `v-if="!entry"` and unmount
// ExecuteActionPackage - and its runner - before the chained OPEN_SFC step could run.
const entry = agentReadyPackages.value.find(x => x.messageId === messageId);

const extraSteps = computed(() => {
  const id = entry?.id;
  if (!id) {
    return undefined;
  }
  const steps = [AGENT_DONE({ id })];

  // Chain member: after offload, auto-SFC to the next stop's planet.
  const chain = parseChainId(id);
  if (!chain) {
    return steps;
  }
  const next = agentReadyPackages.value.find(x => x.id === `${chain.base}-${chain.index + 1}`);
  if (!next) {
    return steps;
  }

  // Ship id from the current package's MTRA origin (ship cargo store).
  const origin = entry?.pkg.actions.find(x => x.type === 'MTRA')?.origin;
  if (origin === undefined || origin === configurableValue) {
    return steps;
  }
  const originStore = deserializeStorage(origin);
  if (originStore?.type !== 'SHIP_STORE') {
    return steps;
  }

  // Destination natural id from the next package's MTRA dest ("UV-351a Base").
  const dest = next.pkg.actions.find(x => x.type === 'MTRA')?.dest;
  if (dest === undefined || dest === configurableValue || !dest.endsWith(' Base')) {
    return steps;
  }
  const destination = dest.slice(0, -' Base'.length);

  // Future: a load phase belongs here (after offload, before the SFC) so goods
  // produced at this planet aren't left behind. Not implemented yet.
  steps.push(OPEN_SFC({ shipId: originStore.addressableId, destination }));
  return steps;
});
</script>

<template>
  <div v-if="!entry"> Package "{{ messageId }}" not found. Refresh XIT AGENT and try again. </div>
  <ExecuteActionPackage v-else :pkg="entry.pkg" :extra-steps="extraSteps" />
</template>
