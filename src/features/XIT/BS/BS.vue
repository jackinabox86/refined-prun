<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import BaseRow from '@src/features/XIT/BS/BaseRow.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';
import { useTileState } from '@src/store/user-data-tiles';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { timestampEachMinute } from '@src/utils/dayjs';

type SortKey = 'name' | 'burn' | 'repair';
type SortDirection = 'asc' | 'desc';

const sortKey = useTileState<SortKey>('sortKey', 'burn');
const sortDirection = useTileState<SortDirection>('sortDirection', 'asc');
const showBurn = useTileState('showBurn', true);
const showProd = useTileState('showProd', true);
const showRepair = useTileState('showRepair', true);

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDirection.value = 'asc';
  }
}

function getSortIndicator(key: SortKey) {
  if (sortKey.value === key) {
    return sortDirection.value === 'asc' ? '▲' : '▼';
  }
  return '▲';
}

function isSorted(key: SortKey) {
  return sortKey.value === key;
}

interface BaseEntry {
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
  days: number | undefined;
  repairDays: number | undefined;
}

const bases = computed<BaseEntry[] | undefined>(() => {
  const sites = sitesStore.all.value;
  if (!sites) {
    return undefined;
  }

  const now = timestampEachMinute.value;
  const entries = sites
    .map(site => {
      const burn = getPlanetBurn(site.siteId);
      return {
        siteId: site.siteId,
        naturalId: getEntityNaturalIdFromAddress(site.address) ?? '',
        planetName: getEntityNameFromAddress(site.address) ?? '',
        storeId: storagesStore.getByAddressableId(site.siteId)?.[0]?.id ?? '',
        days: burn ? countDays(burn.burn) : undefined,
        repairDays: getPlanetRepairAge(site.siteId, now),
      };
    })
    .filter(x => x.naturalId);

  const dir = sortDirection.value === 'asc' ? 1 : -1;

  entries.sort((a, b) => {
    if (sortKey.value === 'burn') {
      const daysA = a.days ?? Infinity;
      const daysB = b.days ?? Infinity;
      if (daysA !== daysB) {
        return (daysA - daysB) * dir;
      }
    }
    if (sortKey.value === 'repair') {
      const repA = a.repairDays ?? -Infinity;
      const repB = b.repairDays ?? -Infinity;
      if (repA !== repB) {
        return (repB - repA) * dir;
      }
    }
    return comparePlanets(a.naturalId, b.naturalId) * dir;
  });

  return entries;
});
</script>

<template>
  <LoadingSpinner v-if="bases === undefined" />
  <template v-else>
    <div :class="C.ComExOrdersPanel.filter">
      <RadioItem v-model="showBurn" horizontal>Burn</RadioItem>
      <RadioItem v-model="showProd" horizontal>Prod</RadioItem>
      <RadioItem v-model="showRepair" horizontal>Repair</RadioItem>
    </div>
    <table :class="$style.table">
      <thead>
        <tr>
          <th :class="[$style.narrowCol, $style.sortable]" @click="setSort('name')">
            Planet
            <span :class="isSorted('name') ? $style.sortActive : $style.sortInactive">{{
              getSortIndicator('name')
            }}</span>
          </th>
          <th :class="[$style.narrowCol, $style.centered]">CMD</th>
          <th
            v-if="showBurn"
            :class="[$style.narrowCol, $style.sortable, $style.burnCol, $style.centered]"
            @click="setSort('burn')">
            Burn
            <span :class="isSorted('burn') ? $style.sortActive : $style.sortInactive">{{
              getSortIndicator('burn')
            }}</span>
          </th>
          <th v-if="showProd" :class="[$style.narrowCol, $style.centered]">Prod</th>
          <th
            v-if="showRepair"
            :class="[$style.narrowCol, $style.sortable, $style.repairCol, $style.centered]"
            @click="setSort('repair')">
            Repair
            <span :class="isSorted('repair') ? $style.sortActive : $style.sortInactive">{{
              getSortIndicator('repair')
            }}</span>
          </th>
          <th :class="$style.invCol">Inv</th>
          <th :class="$style.warCol">War</th>
        </tr>
      </thead>
      <tbody>
        <BaseRow
          v-for="base in bases"
          :key="base.naturalId"
          :site-id="base.siteId"
          :natural-id="base.naturalId"
          :planet-name="base.planetName"
          :store-id="base.storeId"
          :show-burn="showBurn"
          :show-prod="showProd"
          :show-repair="showRepair" />
      </tbody>
    </table>
  </template>
</template>

<style module>
.table {
  border-collapse: collapse;
}

.narrowCol {
  width: 0;
  white-space: nowrap;
}

.invCol {
  width: 67%;
}

.warCol {
  width: 33%;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.centered {
  text-align: center;
}

.sortActive {
  color: rgb(171, 198, 128);
  font-weight: bold;
}

.sortInactive {
  color: rgb(63, 162, 222);
}

.burnCol {
  border-left: 2px solid #3fa2de;
  border-right: 2px solid #3fa2de;
}

.repairCol {
  border-left: 2px solid #3fa2de;
  border-right: 2px solid #3fa2de;
}
</style>
