<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';

const parameters = useXitParameters();
const parameter = parameters.join(' ');

const pkg: UserData.ActionPackageData = {
  global: { name: `GovBurn Data ${parameter}` },
  groups: [],
  actions: [{ type: 'GovBurn Data', name: 'Collect', planet: parameter }],
};
</script>

<template>
  <ExecuteActionPackage :pkg="pkg" />
</template>
