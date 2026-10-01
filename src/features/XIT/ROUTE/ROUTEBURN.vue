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
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { userData } from '@src/store/user-data';
import { timestampEachMinute } from '@src/utils/dayjs';

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
  };
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
          <th :class="$style.centered">Burn</th>
          <th :class="$style.centered">Prod</th>
          <th :class="$style.centered">Rep</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>{{ row.name }}</td>
          <td :class="$style.statusCell">
            <div
              :class="[$style.statusContent, row.burn !== undefined && burnDaysClass(row.burn)]"
              @click="row.burnId && showBuffer(`XIT BURN ${row.burnId}`)">
              <span :class="$style.statusNum">{{ burnText(row.burn) }}</span>
            </div>
          </td>
          <td :class="$style.statusCell">
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
          <td :class="$style.statusCell">
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
            <PrunButton dark inline @click="openConfig(row.id)">CONFIG</PrunButton>
          </td>
        </tr>
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
  padding: 2px 8px;
  border-bottom: 1px solid #2b485a;
  white-space: nowrap;
}

.centered {
  text-align: center;
}

.statusCell {
  text-align: center;
  padding: 2px;
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
