<script setup lang="ts">
import {
  calculateBuildingEntries,
  calculateShipEntries,
  getParameterShips,
  getParameterSites,
} from '@src/features/XIT/REP/entries';
import { timestampEachMinute } from '@src/utils/dayjs';
import dayjs from 'dayjs';
import { fixed1, percent1 } from '@src/utils/format';
import MaterialPurchaseTable from '@src/components/MaterialPurchaseTable.vue';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import { calcBuildingCondition, getRepairLeadDays, getRepairThreshold } from '@src/core/buildings';
import { diffDays } from '@src/utils/time-diff';
import { userData } from '@src/store/user-data';
import { mergeMaterialAmounts } from '@src/core/sort-materials';
import Active from '@src/components/forms/Active.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { repairButtonEnabled } from '@src/features/XIT/REP/repair-button';
import { presentRepairCell, repairCellClass } from '@src/features/XIT/REP/present-repair-cell';
import { objectId } from '@src/utils/object-id';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';

const parameters = useXitParameters();

const sites = computed(() => getParameterSites(parameters));
const ships = computed(() => getParameterShips(parameters));

const isMultiTarget = computed(
  () => (sites.value?.length ?? 0) > 1 || (ships.value?.length ?? 0) > 0,
);

const buildingEntries = computed(() => calculateBuildingEntries(sites.value));
const shipEntries = computed(() => calculateShipEntries(ships.value));

const msInADay = dayjs.duration(1, 'day').asMilliseconds();

const visibleBuildings = computed(() => {
  if (buildingEntries.value === undefined) {
    return undefined;
  }
  const time = timestampEachMinute.value;
  const lead = getRepairLeadDays();
  return buildingEntries.value.filter(entry => {
    const threshold = getRepairThreshold(entry.naturalId);
    const splitDate = time - threshold * msInADay + lead * msInADay;
    return entry.lastRepair < splitDate;
  });
});

const visibleShips = computed(() => shipEntries.value?.filter(x => x.condition <= 0.85));

const materials = computed(() => {
  if (visibleBuildings.value === undefined || visibleShips.value === undefined) {
    return undefined;
  }
  const materials: PrunApi.MaterialAmount[] = [];
  const time = timestampEachMinute.value;
  const lead = getRepairLeadDays();
  for (const building of visibleBuildings.value) {
    const plannedRepairDate = (time - building.lastRepair) / msInADay + lead;
    for (const { material, amount } of building.fullMaterials) {
      materials.push({
        material,
        amount: Math.ceil(amount * (1 - calcBuildingCondition(plannedRepairDate))),
      });
    }
  }
  materials.push(...visibleShips.value.flatMap(x => x.materials));
  return mergeMaterialAmounts(materials);
});

function calculateAge(lastRepair: number) {
  return diffDays(lastRepair, timestampEachMinute.value, true);
}

// Shade the age with the same red/yellow rule the XIT BS and XIT DISPATCH repair
// cells use. The Workforces day classes paint a background, so the caller has to
// put them on an absolutely positioned filler behind the number, the way
// BURN's DaysCell does.
function ageCellClass(lastRepair: number, naturalId: string) {
  return repairCellClass(presentRepairCell(calculateAge(lastRepair), naturalId));
}

const singleSite = computed(() => {
  if (sites.value?.length === 1 && (ships.value?.length ?? 0) === 0) {
    return sites.value[0];
  }
  return undefined;
});

const singleSiteNaturalId = computed(() => {
  const site = singleSite.value;
  return site ? getEntityNaturalIdFromAddress(site.address) : undefined;
});

// The target is read-only here: it is set in XIT SET Gameplay, or per planet in
// XIT PLANETS. A single-site buffer shows that planet's effective target.
const repairTarget = computed(() => getRepairThreshold(singleSiteNaturalId.value));

const targetSource = computed(() => {
  const naturalId = singleSiteNaturalId.value;
  const override =
    naturalId === undefined
      ? undefined
      : userData.settings.repair.planetOverrides?.[naturalId]?.threshold;
  if (override === undefined) {
    return 'Global repair target from XIT SET Gameplay.';
  }
  const site = singleSite.value;
  const planetName = (site ? getEntityNameFromAddress(site.address) : undefined) ?? naturalId;
  return `Per-planet target for ${planetName} from XIT PLANETS.`;
});
</script>

<template>
  <LoadingSpinner v-if="materials === undefined" />
  <template v-else>
    <form>
      <Active label="Repair Target" :tooltip="targetSource" tooltip-position="bottom">
        <span :class="$style.readOnly">{{ repairTarget }}</span>
      </Active>
      <Active
        label="Repair Config"
        tooltip="Repair target and red/yellow thresholds in XIT SET Gameplay."
        tooltip-position="bottom">
        <PrunButton dark @click="showBuffer('XIT SET GAME REPAIR')">CONFIG</PrunButton>
      </Active>
    </form>
    <SectionHeader>Shopping Cart</SectionHeader>
    <MaterialPurchaseTable
      :collapsible="isMultiTarget"
      :collapsed-by-default="true"
      :materials="materials" />
    <SectionHeader>Buildings</SectionHeader>
    <table>
      <thead>
        <tr>
          <th>Ticker</th>
          <th v-if="isMultiTarget">Target</th>
          <th>Age (days)</th>
          <th>Condition</th>
          <th v-if="repairButtonEnabled">CMD</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in visibleBuildings" :key="objectId(entry)">
          <td>{{ entry.ticker }}</td>
          <td v-if="isMultiTarget">
            <PrunLink :command="`XIT REP ${entry.naturalId}`">{{ entry.target }}</PrunLink>
          </td>
          <td :style="{ position: 'relative' }">
            <div
              :style="{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }"
              :class="ageCellClass(entry.lastRepair, entry.naturalId)" />
            <span>{{ fixed1(calculateAge(entry.lastRepair)) }}</span>
          </td>
          <td>{{ percent1(entry.condition) }}</td>
          <td v-if="repairButtonEnabled">
            <PrunButton dark inline @click="showBuffer(`XIT REPAIRACT ${entry.naturalId}`)">
              REP
            </PrunButton>
          </td>
        </tr>
        <tr v-for="entry in visibleShips" :key="objectId(entry)">
          <td>(Ship)</td>
          <td>{{ entry.target }}</td>
          <td>{{ fixed1(calculateAge(entry.lastRepair)) }}</td>
          <td>{{ percent1(entry.condition) }}</td>
          <td v-if="repairButtonEnabled" />
        </tr>
      </tbody>
    </table>
  </template>
</template>

<style module>
.readOnly {
  font-size: 12px;
  line-height: 20px;
}
</style>
