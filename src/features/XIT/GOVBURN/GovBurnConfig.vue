<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import { popiBuildings } from '@src/features/XIT/GOVBURN/buildings';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { userData } from '@src/store/user-data';
import { comparePlanets } from '@src/util';

const emit = defineEmits<{ (e: 'done'): void }>();

const planetInput = ref('');
const planetError = ref(false);

const configuredPlanets = computed(() =>
  Object.keys(userData.govburn.config.planets).sort(comparePlanets),
);

function planetName(naturalId: string) {
  return (
    userData.govburn.planets[naturalId]?.name ?? planetsStore.find(naturalId)?.name ?? naturalId
  );
}

function getRequired(naturalId: string, ticker: string) {
  return userData.govburn.config.planets[naturalId]?.[ticker] ?? 0;
}

function maxRequired(naturalId: string, ticker: string) {
  return (
    userData.govburn.planets[naturalId]?.buildings.find(x => x.ticker === ticker)?.upkeeps
      ?.length ?? 6
  );
}

function setRequired(naturalId: string, ticker: string, value: number | undefined) {
  const config = userData.govburn.config.planets[naturalId];
  if (config === undefined) {
    return;
  }
  const max = maxRequired(naturalId, ticker);
  const n = Math.round(value ?? 0);
  config[ticker] = Math.max(0, Math.min(max, n));
}

function addPlanet() {
  const term = planetInput.value.trim();
  if (!term) {
    planetError.value = true;
    return;
  }
  const planet = planetsStore.find(term);
  if (!planet) {
    planetError.value = true;
    return;
  }
  planetError.value = false;
  userData.govburn.config.planets[planet.naturalId] ??= {};
  planetInput.value = '';
}

function removePlanet(naturalId: string) {
  delete userData.govburn.config.planets[naturalId];
}

function onInputKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter') {
    addPlanet();
  }
}
</script>

<template>
  <div :class="C.ComExOrdersPanel.filter">
    <div :class="$style.spacer" />
    <PrunButton primary @click="emit('done')">DONE</PrunButton>
  </div>

  <SectionHeader>Add Planet</SectionHeader>
  <form>
    <Active label="Planet" :error="planetError">
      <TextInput v-model="planetInput" @keydown="onInputKeydown" />
    </Active>
    <Commands>
      <PrunButton primary @click="addPlanet">ADD</PrunButton>
    </Commands>
  </form>
  <p v-if="planetError" :class="$style.error">Planet not found.</p>

  <table v-if="configuredPlanets.length > 0">
    <thead>
      <tr>
        <th>Planet</th>
        <th v-for="building in popiBuildings" :key="building.ticker">{{ building.ticker }}</th>
        <th />
      </tr>
    </thead>
    <tbody>
      <tr v-for="naturalId in configuredPlanets" :key="naturalId">
        <td :data-tooltip="naturalId">{{ planetName(naturalId) }}</td>
        <td v-for="building in popiBuildings" :key="building.ticker">
          <div :class="[C.forms.input, $style.numberWrap]">
            <NumberInput
              :model-value="getRequired(naturalId, building.ticker)"
              @update:model-value="v => setRequired(naturalId, building.ticker, v)" />
          </div>
        </td>
        <td>
          <PrunButton danger inline @click="removePlanet(naturalId)">REMOVE</PrunButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style module>
.spacer {
  flex: 1;
}

.error {
  margin: 0.25rem 0;
  color: rgb(217, 83, 79);
}

.numberWrap {
  width: 2.5rem;
}

.numberWrap :global(div),
.numberWrap :global(input) {
  width: 100%;
  margin-left: 0;
  text-align: center;
}
</style>
