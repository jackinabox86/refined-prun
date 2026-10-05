<script setup lang="ts">
import ConditionRow from '@src/features/XIT/CONTC/ConditionRow.vue';
import {
  collapsedContractMarker,
  collapseLongContractRows,
  type CollapsedContractEntry,
} from '@src/features/XIT/CONTC/collapse-contract-rows';

const props = defineProps<{
  rows: {
    contract: PrunApi.Contract;
    condition: PrunApi.ContractCondition;
    deadline: number;
  }[];
}>();

const entries = computed(() => collapseLongContractRows(props.rows));

function entryKey(entry: CollapsedContractEntry<(typeof props.rows)[number]>) {
  if (entry.kind === 'condition') {
    return entry.row.condition.id;
  }
  return `collapsed:${entry.contractId}`;
}
</script>

<template>
  <template v-for="entry in entries" :key="entryKey(entry)">
    <ConditionRow
      v-if="entry.kind === 'condition'"
      :contract="entry.row.contract"
      :condition="entry.row.condition"
      :deadline="entry.row.deadline" />
    <tr v-else>
      <td colspan="3" :class="$style.collapsed">{{ collapsedContractMarker }}</td>
    </tr>
  </template>
</template>

<style module>
.collapsed {
  text-align: center;
}
</style>
