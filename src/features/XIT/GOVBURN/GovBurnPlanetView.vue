<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import { popiBuildings } from '@src/features/XIT/GOVBURN/buildings';
import GovBurnDaysCell from '@src/features/XIT/GOVBURN/GovBurnDaysCell.vue';
import { buildingDays } from '@src/features/XIT/GOVBURN/utils';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { userData } from '@src/store/user-data';
import { timestampEachMinute } from '@src/utils/dayjs';

const parameters = useXitParameters();

const parameter = computed(() => parameters.join(' '));

const naturalId = computed(() => {
  const planet = planetsStore.find(parameter.value);
  return planet?.naturalId ?? parameter.value;
});

const displayName = computed(() => {
  const captured = userData.govburn.planets[naturalId.value];
  return captured?.name ?? planetsStore.find(naturalId.value)?.name ?? naturalId.value;
});

const captured = computed(() => userData.govburn.planets[naturalId.value]);

const popiOrder = new Map(popiBuildings.map((x, i) => [x.ticker, i]));

interface BuildingRow {
  ticker: string;
  level: number;
  required: number;
  days: number;
  hasData: boolean;
  order: number;
}

const rows = computed(() => {
  const planet = captured.value;
  if (planet === undefined) {
    return [];
  }
  const now = timestampEachMinute.value;
  const config = userData.govburn.config.planets[naturalId.value] ?? {};
  const result: BuildingRow[] = [];
  for (const building of planet.buildings) {
    if (building.level <= 0) {
      continue;
    }
    const n = config[building.ticker] ?? 0;
    const hasData = building.upkeeps !== undefined;
    const days = hasData
      ? buildingDays(building, n > 0 ? n : (building.upkeeps?.length ?? 0), now)
      : Number.POSITIVE_INFINITY;
    result.push({
      ticker: building.ticker,
      level: building.level,
      required: n,
      days,
      hasData,
      order: popiOrder.get(building.ticker) ?? 999,
    });
  }
  result.sort((a, b) => {
    if (a.hasData !== b.hasData) {
      return a.hasData ? -1 : 1;
    }
    if (a.hasData && a.days !== b.days) {
      return a.days - b.days;
    }
    return a.order - b.order;
  });
  return result;
});
</script>

<template>
  <template v-if="!captured">
    <p>
      No data for {{ displayName }}. Run
      <PrunLink inline :command="`XIT GOVBURNDATA ${naturalId}`">
        XIT GOVBURNDATA {{ naturalId }}
      </PrunLink>
      .
    </p>
  </template>
  <table v-else>
    <thead>
      <tr>
        <th>Building</th>
        <th>Required</th>
        <th>Days</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.ticker">
        <td>{{ row.ticker }} {{ row.level }}</td>
        <td>{{ row.required }}</td>
        <td v-if="!row.hasData" data-tooltip="No data captured. Run XIT GOVBURNDATA.">--</td>
        <GovBurnDaysCell v-else :days="row.days" />
      </tr>
    </tbody>
  </table>
</template>
