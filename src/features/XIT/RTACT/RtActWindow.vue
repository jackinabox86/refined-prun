<script setup lang="ts">
import Header from '@src/components/Header.vue';
import PrunButton from '@src/components/PrunButton.vue';
import { buildStagingPackage } from '@src/features/XIT/RTACT/staging-package';
import { stagedRtRoute } from '@src/features/XIT/RTACT/staged';
import { isStagingHost, STAGING_HOST } from '@src/features/XIT/RTACT/staging-host';
import { useTile } from '@src/hooks/use-tile';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const tile = useTile();
const staging = isStagingHost(location.hostname);
const routeId = ref('');
const specText = ref('');
const error = ref('');

function onRunClick() {
  const built = buildStagingPackage(location.hostname, routeId.value, specText.value);
  if (!built.ok) {
    error.value = built.error;
    return;
  }
  error.value = '';
  stagedRtRoute.value = { pkg: built.pkg };
  if (!dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, null))) {
    showBuffer('XIT RTEXEC');
    return;
  }
  dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, 'XIT RTEXEC'));
}
</script>

<template>
  <div>
    <Header>Staging RT route</Header>
    <p v-if="!staging">This runner only runs on {{ STAGING_HOST }}.</p>
    <template v-else>
      <p>
        One stop per line, at least two. A step sits after a pipe. Each ACT click authorizes one
        add. You click SAVE on the step editor yourself.
      </p>
      <p>ZV-307d</p>
      <p>ANT | load DW 1 100</p>
      <p>ZV-759c | unload DW 1 all</p>
      <p>OT-580 | wait 1 minutes</p>
      <p>AI1 | refuel STL local 100 capacity</p>
      <label>
        Route id (optional, blank creates a route)
        <input v-model="routeId" type="text" autocomplete="off" />
      </label>
      <textarea v-model="specText" :class="$style.spec" />
      <p v-if="error.length > 0">{{ error }}</p>
      <PrunButton primary @click="onRunClick">Run</PrunButton>
    </template>
  </div>
</template>

<style module>
.spec {
  width: 100%;
  min-height: 160px;
  box-sizing: border-box;
}
</style>
