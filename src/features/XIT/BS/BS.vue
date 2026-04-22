<script setup lang="ts">
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import BaseRow from '@src/features/XIT/BS/BaseRow.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';

interface BaseEntry {
  siteId: string;
  naturalId: string;
  planetName: string;
  storeId: string;
}

const bases = computed<BaseEntry[] | undefined>(() => {
  const sites = sitesStore.all.value;
  if (!sites) {
    return undefined;
  }

  return sites
    .map(site => ({
      siteId: site.siteId,
      naturalId: getEntityNaturalIdFromAddress(site.address) ?? '',
      planetName: getEntityNameFromAddress(site.address) ?? '',
      storeId: storagesStore.getByAddressableId(site.siteId)?.[0]?.id ?? '',
    }))
    .filter(x => x.naturalId)
    .sort((a, b) => comparePlanets(a.naturalId, b.naturalId));
});
</script>

<template>
  <LoadingSpinner v-if="bases === undefined" />
  <table v-else>
    <thead>
      <tr>
        <th :class="$style.narrowCol">Planet</th>
        <th :class="$style.narrowCol">CMD</th>
        <th :class="$style.narrowCol">Burn</th>
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
        :store-id="base.storeId" />
    </tbody>
  </table>
</template>

<style module>
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
</style>
