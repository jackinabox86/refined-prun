<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import PrunButton from '@src/components/PrunButton.vue';
import BaseRow from '@src/features/XIT/BS/BaseRow.vue';
import fa from '@src/utils/font-awesome.module.css';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { comparePlanets } from '@src/util';
import { useTileState } from '@src/store/user-data-tiles';
import { userData } from '@src/store/user-data';
import { getPlanetBurn } from '@src/core/burn';
import { getRepairThreshold } from '@src/core/buildings';
import { countDays } from '@src/features/XIT/BURN/utils';
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { compareBases, type SortDirection, type SortKey } from '@src/features/XIT/BS/base-sort';
import { timestampEachMinute } from '@src/utils/dayjs';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { findWithQuery } from '@src/utils/find-with-query';
import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';

const parameters = useXitParameters();

function findSite(term: string, parts: string[]) {
  const naturalId = convertToPlanetNaturalId(term, parts);
  return sitesStore.getByPlanetNaturalId(naturalId);
}

const sortKey = useTileState<SortKey>('sortKey', 'burn');
const sortDirection = useTileState<SortDirection>('sortDirection', 'asc');
const showCmds = useTileState('showCmds', true);
const showBurn = useTileState('showBurn', true);
const showProd = useTileState('showProd', true);
const showRepair = useTileState('showRepair', true);
const showInv = useTileState('showInv', true);
const showWar = useTileState('showWar', true);
const planetFilter = ref('');

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
  burnThreshold: number;
  repairThreshold: number;
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
      const naturalId = getEntityNaturalIdFromAddress(site.address) ?? '';
      return {
        siteId: site.siteId,
        naturalId,
        planetName: getEntityNameFromAddress(site.address) ?? '',
        storeId: storagesStore.getByAddressableId(site.siteId)?.[0]?.id ?? '',
        days: burn ? countDays(burn.burn) : undefined,
        repairDays: getPlanetRepairAge(site.siteId, now),
        burnThreshold: userData.settings.burn.red,
        repairThreshold: getRepairThreshold(naturalId),
      };
    })
    .filter(x => x.naturalId);

  entries.sort((a, b) => compareBases(a, b, sortKey.value, sortDirection.value, comparePlanets));

  return entries;
});

const filteredBases = computed(() => {
  const all = bases.value;
  if (!all) {
    return undefined;
  }

  let result = all;
  if (parameters.length > 0 && sitesStore.all.value) {
    const query = findWithQuery(parameters, findSite);
    let included = query.include;
    if (query.includeAll) {
      included = sitesStore.all.value;
    }
    const includedIds = new Set(
      included
        .filter(x => !query.exclude.has(x))
        .map(x => getEntityNaturalIdFromAddress(x.address)),
    );
    result = result.filter(x => includedIds.has(x.naturalId));
  }

  const filter = planetFilter.value.trim().toUpperCase();
  if (!filter) {
    return result;
  }
  return result.filter(
    x => x.naturalId.toUpperCase().includes(filter) || x.planetName.toUpperCase().includes(filter),
  );
});
</script>

<template>
  <LoadingSpinner v-if="bases === undefined" />
  <template v-else>
    <div :class="C.ComExOrdersPanel.filter">
      <div :class="$style.searchContainer">
        Planet:&nbsp;
        <TextInput v-model="planetFilter" />
        <PrunButton
          v-if="planetFilter"
          dark
          :class="[fa.solid, $style.clearButton]"
          @click="planetFilter = ''">
          {{ '' }}
        </PrunButton>
      </div>
      <RadioItem v-model="showCmds" horizontal>CMDS</RadioItem>
      <RadioItem v-model="showBurn" horizontal>BURN</RadioItem>
      <RadioItem v-model="showProd" horizontal>PROD</RadioItem>
      <RadioItem v-model="showRepair" horizontal>REPAIR</RadioItem>
      <RadioItem v-model="showInv" horizontal>INV</RadioItem>
      <RadioItem v-model="showWar" horizontal>WAR</RadioItem>
      <div
        :class="$style.sortable"
        data-tooltip="Sort by the closer of burn and repair to their thresholds"
        @click="setSort('proximity')">
        NEED
        <span :class="isSorted('proximity') ? $style.sortActive : $style.sortInactive">{{
          getSortIndicator('proximity')
        }}</span>
      </div>
      <div :class="$style.spacer" />
      <PrunButton primary @click="showBuffer('XIT AGENT')">AGENT</PrunButton>
      <PrunButton primary @click="showBuffer('XIT DISPATCH')">DISPATCH</PrunButton>
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
          <th v-if="showCmds" :class="[$style.narrowCol, $style.centered]">CMD</th>
          <th
            v-if="showBurn"
            :class="[$style.narrowCol, $style.sortable, $style.centered]"
            @click="setSort('burn')">
            Burn
            <span :class="isSorted('burn') ? $style.sortActive : $style.sortInactive">{{
              getSortIndicator('burn')
            }}</span>
          </th>
          <th v-if="showProd" :class="[$style.narrowCol, $style.centered]">Prod</th>
          <th
            v-if="showRepair"
            :class="[$style.narrowCol, $style.sortable, $style.centered]"
            @click="setSort('repair')">
            Rep
            <span :class="isSorted('repair') ? $style.sortActive : $style.sortInactive">{{
              getSortIndicator('repair')
            }}</span>
          </th>
          <th v-if="showInv" :class="$style.invCol">Inv</th>
          <th v-if="showWar" :class="$style.warCol">War</th>
        </tr>
      </thead>
      <tbody>
        <BaseRow
          v-for="base in filteredBases"
          :key="base.naturalId"
          :site-id="base.siteId"
          :natural-id="base.naturalId"
          :planet-name="base.planetName"
          :store-id="base.storeId"
          :show-cmds="showCmds"
          :show-burn="showBurn"
          :show-prod="showProd"
          :show-repair="showRepair"
          :show-inv="showInv"
          :show-war="showWar" />
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

.spacer {
  flex: 1;
}

.searchContainer {
  display: flex;
  align-items: center;
}

.searchContainer input {
  background-color: #42361d;
  border-width: 0 0 1px;
  border-bottom: 1px solid #8d6411;
  color: #cccccc;
  padding: 0 5px;

  &:focus {
    outline: none;
  }
}

.clearButton {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 2px;
  width: 18px;
  height: 18px;
  font-size: 11px;
}
</style>
