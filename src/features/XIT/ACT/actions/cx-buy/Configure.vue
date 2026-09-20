<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import { Config } from '@src/features/XIT/ACT/actions/cx-buy/config';
import { userData } from '@src/store/user-data';

const { data, config } = defineProps<{ data: UserData.ActionData; config: Config }>();

const exchanges = ['AI1', 'CI1', 'IC1', 'NC1', 'CI2', 'NC2'];

config.skip ??= false;
config.exchange ??= exchanges[0];
</script>

<template>
  <form>
    <Active
      v-if="data.skippable"
      label="Skip CX Buy"
      tooltip="Whether to skip purchasing materials and only perform the transfer.">
      <RadioItem v-model="config.skip">skip cx buy</RadioItem>
    </Active>
    <Active v-if="!config.skip" label="Exchange">
      <SelectInput v-model="config.exchange" :options="exchanges" />
    </Active>
    <Active
      v-if="!config.skip"
      label="Prices Preview"
      tooltip="Before buying, load missing ticker prices from the CX category listing and show a ranked cost preview. Act pauses 2s; Skip continues to the purchases.">
      <RadioItem v-model="userData.settings.cxPricesPreview">prices preview</RadioItem>
    </Active>
  </form>
</template>
