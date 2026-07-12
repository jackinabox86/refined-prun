<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { stagedArmada } from '@src/features/XIT/ARMADA/staged';
import type { LogTag, LogContent } from '@src/features/XIT/ACT/runner/logger';

function beforeExecute(log: (tag: LogTag, message: LogContent) => void): void {
  const staged = stagedArmada.value;
  if (!staged) {
    return;
  }

  for (const offload of staged.offloads) {
    if (!offload.config.offloadJson) {
      continue;
    }
    const result: UserData.ActionPackageData = {
      global: { name: `Offload ${offload.naturalId}` },
      groups: [
        {
          type: 'Manual',
          name: `Offload ${offload.naturalId}`,
          materials: offload.materials,
        },
      ],
      actions: [
        {
          type: 'MTRA',
          name: `Offload ${offload.naturalId}`,
          group: `Offload ${offload.naturalId}`,
          origin: offload.cargo,
          dest: `${offload.planetName} Base`,
        },
      ],
    };
    log('INFO', `Offload JSON for ${offload.naturalId}:`);
    log(null, JSON.stringify(result, null, 2));
  }
}
</script>

<template>
  <div v-if="!stagedArmada">Nothing staged. Open XIT ARMADA and press EXECUTE.</div>
  <ExecuteActionPackage v-else :pkg="stagedArmada.pkg" :before-execute="beforeExecute" />
</template>
