<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { getPlanetBurn } from '@src/core/burn';
import { sortMaterials } from '@src/core/sort-materials';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { fixed02 } from '@src/utils/format';
import { getBaseStore } from '@src/core/store-id';
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import Passive from '@src/components/forms/Passive.vue';
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
import { getShipsAtCX } from '@src/features/XIT/DISPATCH/utils';
import PlanetSelector from '@src/components/forms/PlanetSelector.vue';
import { userData } from '@src/store/user-data';
import type { BurnValues } from '@src/core/burn';

// Join all parameters in case a natural id was split on underscores by the XIT router.
const parameters = useXitParameters();
const planetParameter = parameters.join(' ');

// The selected base's natural id. A command parameter picks the base it names, otherwise
// the tile keeps its last pick, and a new tile starts on the last base picked anywhere.
const planet = useTileState('planet');
if (!planet.value) {
  planet.value = userData.lowstrife.lastPlanet;
}
watch(planet, value => {
  if (value) {
    userData.lowstrife.lastPlanet = value;
  }
});
// Sites can load after the tile opens, so apply the parameter once it resolves.
const parameterPlanet = computed(() => {
  const site = sitesStore.getByPlanetNaturalIdOrName(planetParameter);
  return site ? getEntityNaturalIdFromAddress(site.address) : undefined;
});
let parameterApplied = false;
watch(
  parameterPlanet,
  naturalId => {
    if (naturalId && !parameterApplied) {
      planet.value = naturalId;
      parameterApplied = true;
    }
  },
  { immediate: true },
);

const site = computed(() => sitesStore.getByPlanetNaturalId(planet.value));
const planetName = computed(() =>
  site.value ? getEntityNameFromAddress(site.value.address) : undefined,
);
const fullBurn = computed(() => getPlanetBurn(site.value)?.burn);

// Materials the user supplies separately. Sticky per planet across tiles.
const excluded = computed(() => userData.lowstrife.exclusions[planet.value ?? ''] ?? []);

function setExcluded(ticker: string, value: boolean) {
  const key = planet.value;
  if (!key) {
    return;
  }
  const next = excluded.value.filter(x => x !== ticker);
  if (value) {
    next.push(ticker);
  }
  if (next.length > 0) {
    userData.lowstrife.exclusions[key] = next;
  } else {
    delete userData.lowstrife.exclusions[key];
  }
}

const burn = computed(() => {
  if (!fullBurn.value) {
    return undefined;
  }
  const result: BurnValues = {};
  for (const [ticker, mat] of Object.entries(fullBurn.value)) {
    if (!excluded.value.includes(ticker)) {
      result[ticker] = mat;
    }
  }
  return result;
});

const shipName = useTileState('ship');
const consumableDays = useTileState('consumableDays');

// Only ships docked at an exchange can pick up the load.
const shipOptions = computed(() =>
  (getShipsAtCX() ?? [])
    .map(x => x.ship.name)
    .filter(x => !!x)
    .sort(),
);

watch(
  shipOptions,
  options => {
    if (options.length > 0 && !options.includes(shipName.value ?? '')) {
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

const baseSpace = computed(() => {
  const store = getBaseStore(planet.value);
  return store
    ? {
        weight: store.weightCapacity,
        volume: store.volumeCapacity,
      }
    : undefined;
});

const load = computed(() => {
  if (!burn.value) {
    return undefined;
  }
  return computeLowstrifeLoad({
    burn: burn.value,
    excludeDwFill: excluded.value.includes('DW'),
    consumableDays: consumableDays.value ?? 0,
    maxWeight: maxWeight.value ?? 0,
    maxVolume: maxVolume.value ?? 0,
    baseSpace: baseSpace.value,
    getMaterial: ticker => materialsStore.getByTicker(ticker),
  });
});

const roleLabels = { consumable: 'consumable', input: 'input', both: 'consumable + input' };

// Loaded materials plus the excluded ones, so an exclusion can be undone from the table.

const rows = computed(() => {
  const result = load.value;
  if (!result || !fullBurn.value) {
    return [];
  }
  const tickers = new Set([
    ...Object.keys(result.materials),
    ...excluded.value.filter(x => fullBurn.value![x] !== undefined),
  ]);
  const materials = [...tickers].map(materialsStore.getByTicker).filter(x => x !== undefined);
  return sortMaterials(materials).map(x => {
    const burnTickers = fullBurn.value!;
    const isExcluded = excluded.value.includes(x.ticker);
    return {
      ticker: x.ticker,
      amount: isExcluded ? 0 : result.materials[x.ticker],
      role: x.ticker in burnTickers ? roleLabels[lowstrifeRole(burnTickers[x.ticker])] : 'fill',
      excluded: isExcluded,
    };
  });
});

const pkg = computed(() =>
  lowstrifePackage({
    planetName: planetName.value ?? planet.value ?? '',
    planetNaturalId: planet.value || undefined,
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
  <form>
    <Active label="Planet" tooltip="The base to load for. Type to filter your bases.">
      <PlanetSelector v-model="planet" />
    </Active>
  </form>
  <div v-if="!site" :class="$style.summary">Select a base.</div>
  <div v-else-if="!burn">Loading burn data...</div>
  <template v-else>
    <form>
      <Active label="Ship" tooltip="The ship to load. Its free cargo space seeds the limits below.">
        <SelectInput v-model="shipName" :options="shipOptions" />
      </Active>
      <Active label="Weight Limit (t)">
        <NumberInput v-model="maxWeight" float :class="$style.number" />
      </Active>
      <Active label="Volume Limit (m³)">
        <NumberInput v-model="maxVolume" float :class="$style.number" />
      </Active>
    </form>
    <div :class="$style.break" />
    <form>
      <Active
        label="Consumable Days"
        tooltip="Workforce consumables are loaded for this many days. Production inputs get the most days that still fit, up to the same number. At 0, inputs fill the ship and DW tops up the rest.">
        <NumberInput v-model="consumableDays" float :class="$style.number" />
      </Active>
      <template v-if="load">
        <Passive label="Input Days" tooltip="Days of production inputs loaded.">
          <span :class="$style.value">
            {{ load.inputDays === undefined ? '--' : fixed02(load.inputDays) }}
          </span>
        </Passive>
        <Passive
          label="Production Days"
          tooltip="Days of production inputs or outputs the base store still holds once the consumables are dropped off. Lower Consumable Days to raise it.">
          <span v-if="load.productionLimit" :class="$style.value">
            ({{ load.productionLimit }})&nbsp;
          </span>
          <span :class="$style.value">
            {{ load.productionDays === undefined ? '--' : load.productionDays.toFixed(1) }}
          </span>
        </Passive>
        <Passive
          label="DW Fill"
          tooltip="Extra DW added to fill the ship's spare room. Skipped when inputs already load for all the consumable days.">
          <span :class="$style.value">{{ load.dwFill }}</span>
        </Passive>
        <Passive
          label="Fill"
          :tooltip="load.fits ? undefined : 'Consumables alone exceed the limits.'">
          <span :class="load.fits ? $style.value : $style.error">
            {{ fixed02(load.weight) }}t, {{ fixed02(load.volume) }}m³
          </span>
        </Passive>
      </template>
    </form>
    <Commands>
      <CopyButton :copy-fn="copyJson" />
      <PrunButton primary :disabled="!canExecute" @click="execute">EXECUTE</PrunButton>
    </Commands>
    <SectionHeader>Load</SectionHeader>
    <table>
      <thead>
        <tr>
          <th
            title="Checked materials are loaded. Uncheck a material you supply separately; the choice is kept per base.">
            Load
          </th>
          <th>Ticker</th>
          <th>Amount</th>
          <th>Days</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td colspan="4">Nothing to load.</td>
        </tr>
        <tr v-for="row in rows" :key="row.ticker" :class="{ [$style.excluded]: row.excluded }">
          <td>
            <input
              type="checkbox"
              :class="$style.checkbox"
              :checked="!row.excluded"
              @change="setExcluded(row.ticker, !($event.target as HTMLInputElement).checked)" />
          </td>
          <td>{{ row.ticker }}</td>
          <td>{{ row.excluded ? '--' : row.amount }}</td>
          <td>{{ row.excluded ? 'excluded' : row.role }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>

<style module>
.summary {
  margin: 4px 4px 4px 8px;
}

.value {
  color: #f7a600;
}

.number {
  width: 158px;
  margin-right: 0;
  margin-left: auto;
}

.number input {
  width: 100%;
  box-sizing: border-box;
}

.break {
  height: 8px;
}

.error {
  color: #d9534f;
}

.excluded {
  color: var(--rp-color-text);
}

.checkbox {
  margin: 0;
  accent-color: #f7a600;
  cursor: pointer;
}
</style>
