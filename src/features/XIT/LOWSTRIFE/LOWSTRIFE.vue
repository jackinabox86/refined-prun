<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { getPlanetBurn } from '@src/core/burn';
import { sortMaterials } from '@src/core/sort-materials';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { fixed02 } from '@src/utils/format';
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import CopyButton from '@src/components/CopyButton.vue';
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import {
  computeLowstrifeLoad,
  lowstrifePackage,
  lowstrifeRole,
} from '@src/features/XIT/LOWSTRIFE/ship-loading';
import { stagedLowstrife } from '@src/features/XIT/LOWSTRIFE/staged';
import { useTileState } from '@src/features/XIT/LOWSTRIFE/tile-state';

// Join all parameters in case a natural id was split on underscores by the XIT router.
const parameters = useXitParameters();
const planetParameter = parameters.join(' ');

const site = computed(() => sitesStore.getByPlanetNaturalIdOrName(planetParameter));
const planetName = computed(() =>
  site.value ? getEntityNameFromAddress(site.value.address) : undefined,
);
const burn = computed(() => getPlanetBurn(site.value)?.burn);

const shipName = useTileState('ship');
const consumableDays = useTileState('consumableDays');

const shipOptions = computed(() =>
  (shipsStore.all.value ?? [])
    .map(x => x.name)
    .filter(x => !!x)
    .sort(),
);

watch(
  shipOptions,
  options => {
    if (!shipName.value && options.length > 0) {
      shipName.value = options[0];
    }
  },
  { immediate: true },
);

const ship = computed(() => (shipName.value ? shipsStore.getByName(shipName.value) : undefined));

const freeCapacity = computed(() => {
  const store = storagesStore.getById(ship.value?.idShipStore);
  if (!store) {
    return { weight: 0, volume: 0 };
  }
  return {
    weight: Number((store.weightCapacity - store.weightLoad).toFixed(2)),
    volume: Number((store.volumeCapacity - store.volumeLoad).toFixed(2)),
  };
});

// Editable caps, re-seeded from the selected ship's free cargo space whenever it changes.
const maxWeight = ref<number | undefined>(0);
const maxVolume = ref<number | undefined>(0);
watch(
  freeCapacity,
  free => {
    maxWeight.value = free.weight;
    maxVolume.value = free.volume;
  },
  { immediate: true },
);

const load = computed(() => {
  if (!burn.value) {
    return undefined;
  }
  return computeLowstrifeLoad({
    burn: burn.value,
    consumableDays: consumableDays.value ?? 0,
    maxWeight: maxWeight.value ?? 0,
    maxVolume: maxVolume.value ?? 0,
    getMaterial: ticker => materialsStore.getByTicker(ticker),
  });
});

const rows = computed(() => {
  const result = load.value;
  if (!result || !burn.value) {
    return [];
  }
  const materials = Object.keys(result.materials)
    .map(materialsStore.getByTicker)
    .filter(x => x !== undefined);
  return sortMaterials(materials).map(x => ({
    ticker: x.ticker,
    amount: result.materials[x.ticker],
    role: lowstrifeRole(burn.value![x.ticker]),
  }));
});

const roleLabels = { consumable: 'consumable', input: 'input', both: 'consumable + input' };

const pkg = computed(() =>
  lowstrifePackage({
    planetName: planetName.value ?? planetParameter,
    shipName: shipName.value || undefined,
    materials: load.value?.materials ?? {},
  }),
);

const canExecute = computed(() => rows.value.length > 0 && load.value?.fits === true);

function copyJson() {
  return JSON.stringify(pkg.value);
}

function execute() {
  // Deep-clone to detach the staged package from this tile's reactivity.
  stagedLowstrife.value = JSON.parse(JSON.stringify(pkg.value));
  showBuffer('XIT LOWSTRIFEACT');
}
</script>

<template>
  <div v-if="!planetParameter">
    Specify a planet, for example: XIT LOWSTRIFE &lt;planet name or natural id&gt;
  </div>
  <div v-else-if="!site">Planet "{{ planetParameter }}" not found.</div>
  <div v-else-if="!burn">Loading burn data...</div>
  <template v-else>
    <form>
      <Active label="Ship" tooltip="The ship to load. Its free cargo space seeds the limits below.">
        <SelectInput v-model="shipName" :options="shipOptions" />
      </Active>
      <Active label="Max Weight (t)">
        <NumberInput v-model="maxWeight" float />
      </Active>
      <Active label="Max Volume (m³)">
        <NumberInput v-model="maxVolume" float />
      </Active>
      <Active
        label="Consumable Days"
        tooltip="Workforce consumables are loaded for this many days. Production inputs get the most days that still fit.">
        <NumberInput v-model="consumableDays" float />
      </Active>
    </form>
    <SectionHeader>Load</SectionHeader>
    <div v-if="load" :class="$style.summary">
      <div>
        Input days:
        <span :class="$style.value">
          {{ load.inputDays === undefined ? '--' : fixed02(load.inputDays) }}
        </span>
        , DW fill: <span :class="$style.value">{{ load.dwFill }}</span>
      </div>
      <div
        title="Days of production whose inputs, or outputs if larger, fit in the space the consumables leave free. Lower Consumable Days to raise it.">
        Production days:
        <span :class="$style.value">
          {{ load.productionDays === undefined ? '--' : load.productionDays.toFixed(1) }}
        </span>
        <span v-if="load.productionLimit"> (limited by {{ load.productionLimit }})</span>
      </div>
      <div :class="{ [$style.error]: !load.fits }">
        {{ fixed02(load.weight) }}t / {{ fixed02(maxWeight ?? 0) }}t, {{ fixed02(load.volume) }}m³ /
        {{ fixed02(maxVolume ?? 0) }}m³
        <span v-if="!load.fits"> - consumables alone exceed the limits</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Amount</th>
          <th>Days</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td colspan="3">Nothing to load.</td>
        </tr>
        <tr v-for="row in rows" :key="row.ticker">
          <td>{{ row.ticker }}</td>
          <td>{{ row.amount }}</td>
          <td>{{ roleLabels[row.role] }}</td>
        </tr>
      </tbody>
    </table>
    <Commands>
      <CopyButton :copy-fn="copyJson" />
      <PrunButton primary :disabled="!canExecute" @click="execute">EXECUTE</PrunButton>
    </Commands>
  </template>
</template>

<style module>
.summary {
  margin: 4px 4px 4px 8px;
}

.value {
  color: #f7a600;
}

.error {
  color: #d9534f;
}
</style>
