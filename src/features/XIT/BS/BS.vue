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
        <th>Planet</th>
        <th>CMD</th>
      </tr>
    </thead>
    <tbody>
      <BaseRow
        v-for="base in bases"
        :key="base.naturalId"
        :natural-id="base.naturalId"
        :planet-name="base.planetName"
        :store-id="base.storeId" />
    </tbody>
  </table>
</template>
