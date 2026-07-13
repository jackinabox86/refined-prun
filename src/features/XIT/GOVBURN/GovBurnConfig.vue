<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
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

const requiredOptions = ['0', '1', '2', '3', '4', '5', '6'];

const configuredPlanets = computed(() =>
  Object.keys(userData.govburn.config.planets).sort(comparePlanets),
);

function planetName(naturalId: string) {
  return (
    userData.govburn.planets[naturalId]?.name ?? planetsStore.find(naturalId)?.name ?? naturalId
  );
}

function buildingLabel(naturalId: string, ticker: string) {
  const building = userData.govburn.planets[naturalId]?.buildings.find(x => x.ticker === ticker);
  if (building && building.level > 0) {
    return `${ticker} (lvl ${building.level})`;
  }
  return ticker;
}

function getRequired(naturalId: string, ticker: string) {
  return String(userData.govburn.config.planets[naturalId]?.[ticker] ?? 0);
}

function setRequired(naturalId: string, ticker: string, value: string) {
  const config = userData.govburn.config.planets[naturalId];
  if (config === undefined) {
    return;
  }
  config[ticker] = Number(value);
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

  <template v-for="naturalId in configuredPlanets" :key="naturalId">
    <SectionHeader>
      <span>{{ planetName(naturalId) }} ({{ naturalId }})</span>
      <PrunButton danger :class="$style.remove" @click="removePlanet(naturalId)">REMOVE</PrunButton>
    </SectionHeader>
    <table>
      <thead>
        <tr>
          <th>Building</th>
          <th>Required</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="building in popiBuildings" :key="building.ticker">
          <td>{{ buildingLabel(naturalId, building.ticker) }}</td>
          <td>
            <div :class="[C.forms.input, $style.selectWrap]">
              <SelectInput
                :model-value="getRequired(naturalId, building.ticker)"
                :options="requiredOptions"
                @update:model-value="v => setRequired(naturalId, building.ticker, v ?? '0')" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </template>
</template>

<style module>
.spacer {
  flex: 1;
}

.error {
  margin: 0.25rem 0;
  color: rgb(217, 83, 79);
}

.remove {
  margin-left: 0.5rem;
}

.selectWrap {
  width: 4rem;
}

.selectWrap :global(div) {
  width: 100%;
  margin-left: 0;
}
</style>
