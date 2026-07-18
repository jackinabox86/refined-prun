<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import GovBurnConfig from '@src/features/XIT/GOVBURN/GovBurnConfig.vue';
import GovBurnDaysCell from '@src/features/XIT/GOVBURN/GovBurnDaysCell.vue';
import { planetDays } from '@src/features/XIT/GOVBURN/utils';
import { store as planetContextMenu } from '@src/features/XIT/planet-context-menu';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { userData } from '@src/store/user-data';
import { comparePlanets } from '@src/util';
import { timestampEachMinute } from '@src/utils/dayjs';

const showConfig = ref(false);

interface PlanetRow {
  naturalId: string;
  name: string;
  days: number;
  hasData: boolean;
}

const rows = computed(() => {
  const now = timestampEachMinute.value;
  const result: PlanetRow[] = [];
  for (const naturalId of Object.keys(userData.govburn.config.planets)) {
    const config = userData.govburn.config.planets[naturalId] ?? {};
    const captured = userData.govburn.planets[naturalId];
    const planet = planetsStore.find(naturalId);
    const name =
      getEntityNameFromAddress(planet?.address) ?? captured?.name ?? planet?.name ?? naturalId;
    if (captured === undefined) {
      result.push({ naturalId, name, days: Number.POSITIVE_INFINITY, hasData: false });
      continue;
    }
    const { days, hasData } = planetDays(captured, config, now);
    result.push({ naturalId, name, days, hasData });
  }
  result.sort((a, b) => {
    if (a.hasData !== b.hasData) {
      return a.hasData ? -1 : 1;
    }
    if (a.hasData && a.days !== b.days) {
      return a.days - b.days;
    }
    return comparePlanets(a.naturalId, b.naturalId);
  });
  return result;
});

function openPlanet(naturalId: string) {
  showBuffer(`XIT GOVBURN ${naturalId}`);
}

function onActClick(naturalId: string) {
  showBuffer(`XIT GOVBURNACT ${naturalId}`);
}
</script>

<template>
  <GovBurnConfig v-if="showConfig" @done="showConfig = false" />
  <template v-else>
    <div :class="C.ComExOrdersPanel.filter">
      <div :class="$style.spacer" />
      <PrunButton primary @click="showConfig = true">CONFIG</PrunButton>
      <PrunButton primary @click="showBuffer('XIT GOVBURNDATA')">DATA</PrunButton>
    </div>
    <p v-if="rows.length === 0" :class="$style.empty">No planets configured.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Planet</th>
          <th>Days</th>
          <th>CMD</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.naturalId">
          <td
            :class="$style.planet"
            @click="openPlanet(row.naturalId)"
            @contextmenu.prevent="planetContextMenu.showMenu($event, row.naturalId)">
            {{ row.name }}
          </td>
          <td
            v-if="!row.hasData"
            data-tooltip="No data captured. Run XIT GOVBURNDATA."
            :class="$style.noData"
            @click="openPlanet(row.naturalId)">
            --
          </td>
          <GovBurnDaysCell v-else :days="row.days" :on-click="() => openPlanet(row.naturalId)" />
          <td>
            <PrunButton dark inline @click="onActClick(row.naturalId)">ACT</PrunButton>
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

.empty {
  margin: 0.5rem 0;
}

.noData {
  cursor: pointer;
}

.planet {
  font-weight: bold;
  cursor: pointer;
}
</style>
