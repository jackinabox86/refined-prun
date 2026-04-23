<script setup lang="ts">
import SelectInput from '@src/components/forms/SelectInput.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import Active from '@src/components/forms/Active.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/repair/config';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { userData } from '@src/store/user-data';

const { data, config } = defineProps<{ data: UserData.MaterialGroupData; config: Config }>();

const planets = computed(() =>
  (sitesStore.all.value ?? [])
    .map(x => getEntityNameFromAddress(x.address))
    .filter(x => x !== undefined)
    .sort(comparePlanets),
);

if (data.planet === configurableValue && !config.planet) {
  config.planet = planets.value[0];
}

if (data.days === configurableValue && config.days === undefined) {
  config.days = userData.settings.repair.threshold;
}

// REPAIRACT uses a 1-day time offset by default, not the user's XIT REP offset.
if (data.advanceDays === configurableValue && config.advanceDays === undefined) {
  config.advanceDays = 1;
}
</script>

<template>
  <form>
    <Active v-if="data.planet === configurableValue" label="Planet">
      <SelectInput v-model="config.planet" :options="planets" />
    </Active>
    <Active
      v-if="data.days === configurableValue"
      label="Day Threshold"
      tooltip="All buildings older than this threshold will be repaired.">
      <NumberInput v-model="config.days" />
    </Active>
    <Active
      v-if="data.advanceDays === configurableValue"
      label="Time Offset"
      tooltip="The number of days in the future this repair will be conducted.">
      <NumberInput v-model="config.advanceDays" />
    </Active>
  </form>
</template>
