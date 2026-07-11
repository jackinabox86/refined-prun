<script setup lang="ts">
import {
  agentChannelStore,
  channelIdentifier,
  fetchAgentChannel,
  openAgentChannelWithDraft,
} from '@src/infrastructure/prun-api/data/agent-channel';
import { agentReadyPackages } from '@src/features/XIT/ACT/agent-sync';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import PrunButton from '@src/components/PrunButton.vue';
import PrunLink from '@src/components/PrunLink.vue';
import ActionBar from '@src/components/ActionBar.vue';

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
  <ActionBar>
    <PrunButton primary :disabled="loading" @click="refresh">REFRESH</PrunButton>
  </ActionBar>
  <div v-if="inaccessible">
    The "{{ channelIdentifier }}" channel isn't set up yet. Open
    <PrunLink command="COM" inline>COM</PrunLink>, click "new group", add no other members, and name
    it "{{ channelIdentifier }}".
  </div>
  <LoadingSpinner v-else-if="loading" />
  <div v-else-if="!fetched">Click REFRESH to load the agent channel.</div>
  <table v-else>
    <thead>
      <tr>
        <th>Name</th>
        <th>Id</th>
        <th>Execute</th>
        <th>Dismiss</th>
      </tr>
    </thead>
    <tbody v-if="packages.length === 0">
      <tr>
        <td colspan="4">No ready action packages.</td>
      </tr>
    </tbody>
    <tbody v-else>
      <tr v-for="entry in packages" :key="entry.messageId">
        <td>{{ entry.pkg.global.name }}</td>
        <td>{{ entry.id ?? '--' }}</td>
        <td>
          <PrunButton v-if="entry.ready" primary @click="openPackage(entry.messageId)">
            OPEN
          </PrunButton>
          <template v-else>waiting for ship to land</template>
        </td>
        <td>
          <PrunButton v-if="entry.id" dark inline @click="openAgentChannelWithDraft(entry.id)">
            dismiss
          </PrunButton>
          <template v-else>--</template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
