<script setup lang="ts">
import SelectInput from '@src/components/forms/SelectInput.vue';
import Active from '@src/components/forms/Active.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/resupply/config';
import { computeResupplyBill } from '@src/features/XIT/ACT/material-groups/resupply/bill';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { userData } from '@src/store/user-data';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { fixed02 } from '@src/utils/format';

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
  config.days = userData.settings.burn.resupply ?? 10;
}

const effectivePlanet = computed(() =>
  data.planet === configurableValue ? config.planet : data.planet,
);

const effectiveDays = computed(() => {
  if (data.days === configurableValue) {
    return config.days;
  }
  if (typeof data.days === 'number') {
    return data.days;
  }
  const parsed = parseFloat(data.days as string);
  return isNaN(parsed) ? undefined : parsed;
});

const bill = computed(() => computeResupplyBill(data, effectivePlanet.value, effectiveDays.value));

const totals = computed(() => {
  const entries = bill.value;
  if (!entries) {
    return undefined;
  }
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(entries)) {
    const mat = materialsStore.getByTicker(ticker);
    if (mat) {
      weight += mat.weight * amount;
      volume += mat.volume * amount;
    }
  }
  return { weight, volume };
});
</script>

<template>
  <form>
    <Active v-if="data.planet === configurableValue" label="Planet">
      <SelectInput v-model="config.planet" :options="planets" />
    </Active>
    <Active
      v-if="data.days === configurableValue"
      label="Days"
      tooltip="The number of days of supplies to refill the planet with.">
      <NumberInput v-model="config.days" />
    </Active>
  </form>
  <div :class="$style.totals">
    <template v-if="totals">
      <span>Total Weight </span>
      <span :class="$style.value">{{ fixed02(totals.weight) }}t</span>
      <span>, Total Volume </span>
      <span :class="$style.value">{{ fixed02(totals.volume) }}m³</span>
    </template>
    <template v-else>
      <span>Total Weight --, Total Volume --</span>
    </template>
  </div>
</template>

<style module>
.totals {
  margin: 4px 4px 4px 8px;
}

.value {
  color: #f7a600;
}
</style>
