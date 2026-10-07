<script setup lang="ts">
import ConditionItem from '@src/features/XIT/CONTS/ConditionItem.vue';
import {
  capContractEntries,
  hiddenContractEntriesMarker,
} from '@src/features/XIT/CONTS/cap-contract-entries';

const { conditions, contract } = defineProps<{
  conditions: PrunApi.ContractCondition[];
  contract: PrunApi.Contract;
}>();

const filtered = computed(() => {
  return conditions
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter(x => x.type !== 'LOAN_INSTALLMENT');
});
const loanInstallments = computed(() => conditions.filter(x => x.type === 'LOAN_INSTALLMENT'));
const loanTotal = computed(() => loanInstallments.value.length);
const loanFilled = computed(
  () => loanInstallments.value.filter(x => x.status === 'FULFILLED').length,
);
const visible = computed(() => capContractEntries(filtered.value));
</script>

<template>
  <ConditionItem
    v-for="condition in visible.entries"
    :key="condition.id"
    :condition="condition"
    :contract="contract" />
  <div v-if="visible.hidden" :style="{ textAlign: 'center' }">{{
    hiddenContractEntriesMarker
  }}</div>
  <div v-if="loanTotal !== 0">{{ loanFilled }}/{{ loanTotal }} Loan Installment</div>
</template>
