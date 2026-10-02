<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { getRepairThreshold } from '@src/core/buildings';
import { getPlanetBurn } from '@src/core/burn';
import { getPlanetProduction } from '@src/core/production';
import { formatBsBurnDays } from '@src/features/XIT/BS/format-bs-burn-days';
import { burnDaysClass, countDays } from '@src/features/XIT/BURN/utils';
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { presentRepairCell, repairCellClass } from '@src/features/XIT/REP/present-repair-cell';
import {
  cumulativeSecondsBeforeStop,
  minAdjustedBurn,
  paddedLegSeconds,
  SECONDS_PER_DAY,
} from '@src/features/XIT/ROUTE/route-calc';
import { removeRoute } from '@src/features/XIT/ROUTE/routes';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { userData } from '@src/store/user-data';
import { timestampEachMinute } from '@src/utils/dayjs';

const expanded = ref<string[]>([]);

const rows = computed(() => {
  const now = timestampEachMinute.value;
  return userData.routes.map(route => summarize(route, now));
});

function siteFor(id: string) {
  return sitesStore.getByPlanetNaturalId(id);
}

function summarize(route: UserData.ShippingRoute, now: number) {
  const padded = paddedLegSeconds(route.legs ?? []);
  const burnDays = route.stops.map(stop => {
    if (stop.kind !== 'base') {
      return undefined;
    }
    const site = siteFor(stop.id);
    if (site === undefined) {
      return undefined;
    }
    const burn = getPlanetBurn(site.siteId);
    if (burn === undefined) {
      return undefined;
    }
    return countDays(burn.burn);
  });
  const burn = minAdjustedBurn(burnDays, padded);
  let burnId: string | undefined;
  let lowest = burn;
  if (burn !== undefined) {
    for (let i = 0; i < route.stops.length; i++) {
      const days = burnDays[i];
      const stop = route.stops[i];
      if (days === undefined || stop === undefined || stop.kind !== 'base') {
        continue;
      }
      const adjusted = days - cumulativeSecondsBeforeStop(padded, i) / SECONDS_PER_DAY;
      if (adjusted === lowest) {
        burnId = stop.id;
        break;
      }
    }
  }

  let prodShort = false;
  let prodSeen = false;
  let prodId: string | undefined;
  for (const stop of route.stops) {
    if (stop.kind !== 'base') {
      continue;
    }
    const site = siteFor(stop.id);
    if (site === undefined) {
      continue;
    }
    const prod = getPlanetProduction(site.siteId);
    if (prod === undefined || prod.production.length === 0) {
      continue;
    }
    prodSeen = true;
    const orders = sumBy(prod.production, x => x.orders.length);
    const capacity = sumBy(prod.production, x => x.capacity);
    if (orders < capacity) {
      prodShort = true;
      prodId = stop.id;
      break;
    }
    prodId = prodId ?? stop.id;
  }

  let repairId: string | undefined;
  let repairAge: number | undefined;
  let repairRemaining: number | undefined;
  for (const stop of route.stops) {
    if (stop.kind !== 'base') {
      continue;
    }
    const site = siteFor(stop.id);
    if (site === undefined) {
      continue;
    }
    const age = getPlanetRepairAge(site.siteId, now);
    if (age === undefined) {
      continue;
    }
    const remaining = getRepairThreshold(stop.id) - age;
    if (repairRemaining === undefined || remaining < repairRemaining) {
      repairRemaining = remaining;
      repairAge = age;
      repairId = stop.id;
    }
  }

  return {
    id: route.id,
    name: route.name,
    burn,
    burnId,
    prodSeen,
    prodShort,
    prodId,
    repairAge,
    repairId,
    bases: route.stops.filter(stop => stop.kind === 'base').map(stop => baseInfo(stop.id, now)),
  };
}

function baseInfo(id: string, now: number) {
  const site = siteFor(id);
  const name = site === undefined ? id : (getEntityNameFromAddress(site.address) ?? id);
  const planet = site === undefined ? undefined : getPlanetBurn(site.siteId);
  const burn = planet === undefined ? undefined : countDays(planet.burn);
  const production =
    (site === undefined ? undefined : getPlanetProduction(site.siteId))?.production ?? [];
  const prodSeen = production.length > 0;
  const orders = sumBy(production, x => x.orders.length);
  const capacity = sumBy(production, x => x.capacity);
  const age = site === undefined ? undefined : getPlanetRepairAge(site.siteId, now);
  return {
    id,
    name,
    burn,
    prodSeen,
    prodShort: prodSeen && orders < capacity,
    repairAge: age,
  };
}

function toggle(id: string) {
  if (expanded.value.includes(id)) {
    expanded.value = expanded.value.filter(x => x !== id);
    return;
  }
  expanded.value = [...expanded.value, id];
}

function onRemove(id: string) {
  removeRoute(id);
  expanded.value = expanded.value.filter(x => x !== id);
}

function burnText(days: number | undefined) {
  if (days === undefined) {
    return '-';
  }
  return formatBsBurnDays(days, userData.settings.burn.decimalDays === true);
}

function openConfig(id?: string) {
  showBuffer(id === undefined ? 'XIT ROUTECONFIG' : `XIT ROUTECONFIG ${id}`);
}
</script>

<template>
  <div>
    <div :class="C.ComExOrdersPanel.filter">
      <PrunButton primary @click="openConfig()">NEW</PrunButton>
    </div>
    <p v-if="rows.length === 0" :class="$style.note">No routes yet.</p>
    <table v-else :class="$style.table">
      <thead>
        <tr>
          <th>Route</th>
          <th :class="$style.metric">Burn</th>
          <th :class="$style.metric">Prod</th>
          <th :class="$style.metric">Rep</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.id">
          <tr>
            <td :class="$style.title" @click="toggle(row.id)">
              <span :class="$style.plus">{{ expanded.includes(row.id) ? '-' : '+' }}</span>
              <span>{{ row.name }}</span>
            </td>
            <td :class="$style.metric">
              <div
                :class="[$style.statusContent, row.burn !== undefined && burnDaysClass(row.burn)]"
                @click="row.burnId && showBuffer(`XIT BURN ${row.burnId}`)">
                <span :class="$style.statusNum">{{ burnText(row.burn) }}</span>
              </div>
            </td>
            <td :class="$style.metric">
              <div
                :class="[
                  $style.statusContent,
                  row.prodSeen && {
                    [C.Workforces.daysMissing]: row.prodShort,
                    [C.Workforces.daysSupplied]: !row.prodShort,
                  },
                ]"
                @click="row.prodId && showBuffer(`XIT PROD ${row.prodId}`)">
                <span :class="$style.statusNum">{{
                  row.prodSeen ? (row.prodShort ? '∅' : '✓') : '-'
                }}</span>
              </div>
            </td>
            <td :class="$style.metric">
              <div
                :class="[
                  $style.statusContent,
                  repairCellClass(
                    row.repairAge !== undefined && row.repairId !== undefined
                      ? presentRepairCell(row.repairAge, row.repairId)
                      : undefined,
                  ),
                ]"
                @click="row.repairId && showBuffer(`XIT REP ${row.repairId}`)">
                <span :class="$style.statusNum">{{
                  row.repairAge !== undefined && row.repairId !== undefined
                    ? presentRepairCell(row.repairAge, row.repairId).text
                    : '-'
                }}</span>
              </div>
            </td>
            <td>
              <div :class="$style.actions">
                <PrunButton dark inline @click="onRemove(row.id)">REMOVE</PrunButton>
                <PrunButton dark inline @click="openConfig(row.id)">CONFIG</PrunButton>
              </div>
            </td>
          </tr>
          <tr
            v-for="(base, index) in expanded.includes(row.id) ? row.bases : []"
            :key="`${row.id}:${index}`">
            <td :class="$style.baseTitle">{{ base.name }}</td>
            <td :class="$style.metric">
              <div
                :class="[$style.statusContent, base.burn !== undefined && burnDaysClass(base.burn)]"
                @click="showBuffer(`XIT BURN ${base.id}`)">
                <span :class="$style.statusNum">{{ burnText(base.burn) }}</span>
              </div>
            </td>
            <td :class="$style.metric">
              <div
                :class="[
                  $style.statusContent,
                  base.prodSeen && {
                    [C.Workforces.daysMissing]: base.prodShort,
                    [C.Workforces.daysSupplied]: !base.prodShort,
                  },
                ]"
                @click="showBuffer(`XIT PROD ${base.id}`)">
                <span :class="$style.statusNum">{{
                  base.prodSeen ? (base.prodShort ? '∅' : '✓') : '-'
                }}</span>
              </div>
            </td>
            <td :class="$style.metric">
              <div
                :class="[
                  $style.statusContent,
                  repairCellClass(
                    base.repairAge !== undefined
                      ? presentRepairCell(base.repairAge, base.id)
                      : undefined,
                  ),
                ]"
                @click="showBuffer(`XIT REP ${base.id}`)">
                <span :class="$style.statusNum">{{
                  base.repairAge !== undefined
                    ? presentRepairCell(base.repairAge, base.id).text
                    : '-'
                }}</span>
              </div>
            </td>
            <td />
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style module>
.table {
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 2px 4px;
  border-bottom: 1px solid #2b485a;
  white-space: nowrap;
}

.title {
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}

.plus {
  display: inline-block;
  width: 26px;
  text-align: center;
}

.baseTitle {
  font-weight: bold;
  font-size: 12px;
  padding-left: 26px;
}

.metric {
  width: 52px;
  max-width: 52px;
  padding: 1px 2px;
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: row;
  column-gap: 0.25rem;
}

.statusContent {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 2px 4px;
}

.statusNum {
  min-width: 3ch;
  text-align: center;
}

.note {
  margin: 8px;
}
</style>
