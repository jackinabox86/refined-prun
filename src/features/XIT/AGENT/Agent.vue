<script setup lang="ts">
import {
  agentChannelStore,
  channelIdentifier,
  fetchAgentChannel,
} from '@src/infrastructure/prun-api/data/agent-channel';
import { agentReadyPackages } from '@src/features/XIT/ACT/agent-sync';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import PrunButton from '@src/components/PrunButton.vue';
import PrunLink from '@src/components/PrunLink.vue';

const loading = ref(false);

async function refresh() {
  loading.value = true;
  await fetchAgentChannel();
  loading.value = false;
}

const fetched = computed(() => agentChannelStore.fetched.value);
const inaccessible = computed(() => agentChannelStore.inaccessible.value);
const packages = computed(() => agentReadyPackages.value);

function openPackage(messageId: string) {
  showBuffer(`XIT AGENT ${messageId}`);
}
</script>

<template>
  <div>
    <PrunButton :disabled="loading" @click="refresh">REFRESH</PrunButton>
    <div v-if="inaccessible">
      The "{{ channelIdentifier }}" channel isn't set up yet. Open
      <PrunLink command="COM" inline>COM</PrunLink>, click "new group", add no other members, and
      name it "{{ channelIdentifier }}".
    </div>
    <LoadingSpinner v-else-if="loading" />
    <div v-else-if="!fetched">Click REFRESH to load the agent channel.</div>
    <div v-else-if="packages.length === 0">No ready action packages.</div>
    <ul v-else>
      <li v-for="entry in packages" :key="entry.messageId">
        {{ entry.pkg.global.name }}
        <PrunButton v-if="entry.ready" @click="openPackage(entry.messageId)">OPEN</PrunButton>
        <template v-else> (waiting for ship to land)</template>
      </li>
    </ul>
  </div>
</template>
