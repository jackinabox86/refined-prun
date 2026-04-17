<script setup lang="ts">
import SectionHeader from '@src/components/SectionHeader.vue';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { userData } from '@src/store/user-data';

const planets = computed(() => {
  const sites = sitesStore.all.value ?? [];
  return sites
    .map(site => ({
      naturalId: getEntityNaturalIdFromAddress(site.address) ?? '',
      name: getEntityNameFromAddress(site.address) ?? '',
    }))
    .filter(p => p.naturalId)
    .sort((a, b) => a.name.localeCompare(b.name));
});

function isEnabled(naturalId: string) {
  return !userData.settings.notifications.disabledPlanets.includes(naturalId);
}

function toggle(naturalId: string) {
  const disabled = userData.settings.notifications.disabledPlanets;
  const idx = disabled.indexOf(naturalId);
  if (idx === -1) {
    disabled.push(naturalId);
  } else {
    disabled.splice(idx, 1);
  }
}

function enableAll() {
  userData.settings.notifications.disabledPlanets.length = 0;
}

function disableAll() {
  const disabled = userData.settings.notifications.disabledPlanets;
  disabled.length = 0;
  for (const p of planets.value) {
    disabled.push(p.naturalId);
  }
}
</script>

<template>
  <SectionHeader>Planet Filter</SectionHeader>
  <table>
    <thead>
      <tr>
        <th>Planet</th>
        <th>Notifications</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="planet in planets" :key="planet.naturalId">
        <td>{{ planet.name }}</td>
        <td>
          <div :class="[C.RadioGroup.container, C.RadioGroup.horizontal]">
            <span
              :class="[C.RadioItem.container, C.RadioItem.containerHorizontal]"
              @click="() => { if (!isEnabled(planet.naturalId)) toggle(planet.naturalId); }">
              <div
                :class="[
                  C.RadioItem.indicator,
                  C.RadioItem.indicatorHorizontal,
                  isEnabled(planet.naturalId) ? [C.RadioItem.active, C.effects.shadowPrimary] : '',
                ]" />
              <div
                :class="[
                  C.RadioItem.value,
                  C.fonts.fontRegular,
                  C.type.typeSmall,
                  C.RadioItem.valueHorizontal,
                ]">
                enabled
              </div>
            </span>
            <span
              :class="[C.RadioItem.container, C.RadioItem.containerHorizontal]"
              @click="() => { if (isEnabled(planet.naturalId)) toggle(planet.naturalId); }">
              <div
                :class="[
                  C.RadioItem.indicator,
                  C.RadioItem.indicatorHorizontal,
                  !isEnabled(planet.naturalId) ? [C.RadioItem.active, C.effects.shadowPrimary] : '',
                ]" />
              <div
                :class="[
                  C.RadioItem.value,
                  C.fonts.fontRegular,
                  C.type.typeSmall,
                  C.RadioItem.valueHorizontal,
                ]">
                disabled
              </div>
            </span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-if="planets.length === 0">No planets found. Make sure your base data is loaded.</div>
  <div :class="[C.RadioGroup.container, C.RadioGroup.horizontal]" style="margin-top: 8px; gap: 8px;">
    <span
      :class="[C.RadioItem.container, C.RadioItem.containerHorizontal]"
      @click="enableAll">
      <div :class="[C.RadioItem.indicator, C.RadioItem.indicatorHorizontal]" />
      <div :class="[C.RadioItem.value, C.fonts.fontRegular, C.type.typeSmall, C.RadioItem.valueHorizontal]">
        Enable All
      </div>
    </span>
    <span
      :class="[C.RadioItem.container, C.RadioItem.containerHorizontal]"
      @click="disableAll">
      <div :class="[C.RadioItem.indicator, C.RadioItem.indicatorHorizontal]" />
      <div :class="[C.RadioItem.value, C.fonts.fontRegular, C.type.typeSmall, C.RadioItem.valueHorizontal]">
        Disable All
      </div>
    </span>
  </div>
</template>
