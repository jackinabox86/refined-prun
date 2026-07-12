<script setup lang="ts">
import PrunLink from '@src/components/PrunLink.vue';
import PrunButton from '@src/components/PrunButton.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import GripCell from '@src/components/grip/GripCell.vue';
import { getPlanetBurn } from '@src/core/burn';
import { countDays } from '@src/features/XIT/BURN/utils';
import { userData } from '@src/store/user-data';
import { getRepairOffset, getRepairThreshold } from '@src/core/buildings';
import { getPlanetRepairAge } from '@src/features/XIT/REP/entries';
import { timestampEachMinute } from '@src/utils/dayjs';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { fixed0 } from '@src/utils/format';
import { ArmadaBaseConfig, billTotals, combinedBaseBill } from '@src/features/XIT/ARMADA/utils';

const { siteId, naturalId, planetName, config } = defineProps<{
  siteId: string;
  naturalId: string;
  planetName: string;
  config: ArmadaBaseConfig;
}>();

const burn = computed(() => getPlanetBurn(siteId));
const days = computed(() => (burn.value ? countDays(burn.value.burn) : undefined));

const burnBgClass = computed(() => {
  if (days.value === undefined) {
    return {};
  }
  const d = Math.floor(days.value);
  return {
    [C.Workforces.daysMissing]: d <= userData.settings.burn.red,
    [C.Workforces.daysWarning]: d <= userData.settings.burn.yellow,
    [C.Workforces.daysSupplied]: d > userData.settings.burn.yellow,
  };
});

const daysText = computed(() => {
  if (days.value === undefined) {
    return '-';
  }
  const d = Math.floor(days.value);
  return d < 500 ? String(d) : '∞';
});

const repairAge = computed(() => getPlanetRepairAge(siteId, timestampEachMinute.value));

const repairBgClass = computed(() => {
  const age = repairAge.value;
  if (age === undefined) {
    return {};
  }
  const threshold = getRepairThreshold(naturalId);
  const offset = getRepairOffset(naturalId);
  const d = Math.floor(age);
  return {
    [C.Workforces.daysMissing]: d >= threshold,
    [C.Workforces.daysWarning]: d >= threshold - offset,
    [C.Workforces.daysSupplied]: d < threshold - offset,
  };
});

const repairDaysText = computed(() => {
  const age = repairAge.value;
  if (age === undefined) {
    return '-';
  }
  return String(Math.floor(age));
});

const site = computed(() => sitesStore.getById(siteId));

const loadText = computed(() => {
  const s = site.value;
  if (!s) {
    return '--';
  }
  if (!config.resupply && !config.repair) {
    return '--';
  }
  const bill = combinedBaseBill(naturalId, config, s);
  if (!bill) {
    return '--';
  }
  const totals = billTotals(bill);
  return `${fixed0(totals.weight)}t - ${fixed0(totals.volume)}m³`;
});

const assignedShip = computed(() => (config.ship ? shipsStore.getById(config.ship) : undefined));

const shipLabel = computed(
  () => assignedShip.value?.name ?? assignedShip.value?.registration ?? config.ship,
);

const dragOver = ref(false);

// Game's top-level dragover handler cancels foreign drops (sets dropEffect
// to 'none'), which makes the browser animate the drag ghost snap-back.
// Stop propagation so our dropEffect wins.
function onDragEnter(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer!.dropEffect = 'copy';
  dragOver.value = true;
}

function onDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer!.dropEffect = 'copy';
  dragOver.value = true;
}

function onDragLeave() {
  dragOver.value = false;
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragOver.value = false;
  const shipId = event.dataTransfer?.getData('text/plain');
  if (!shipId) {
    return;
  }
  config.ship = shipId;
}

function clearShip() {
  config.ship = undefined;
}
</script>

<template>
  <tr :class="$style.row">
    <GripCell />
    <td :class="$style.planetCell">
      <PrunLink inline :command="`BS ${naturalId}`" :class="$style.planetLink">{{
        planetName
      }}</PrunLink>
    </td>
    <td :class="$style.toggleCell">
      <RadioItem v-model="config.resupply" />
    </td>
    <td :class="$style.statusCell">
      <div :class="[$style.statusContent, burnBgClass]">
        <span :class="$style.statusNum">{{ daysText }}</span>
      </div>
    </td>
    <td :class="$style.toggleCell">
      <RadioItem v-model="config.repair" />
    </td>
    <td :class="$style.statusCell">
      <div :class="[$style.statusContent, repairBgClass]">
        <span :class="$style.statusNum">{{ repairDaysText }}</span>
      </div>
    </td>
    <td :class="[C.type.typeSmall, $style.loadCell]">{{ loadText }}</td>
    <td
      :class="[$style.shipCell, dragOver && $style.shipCellOver]"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop">
      <template v-if="config.ship && shipLabel">
        <div :class="$style.shipAssigned">
          <PrunButton primary inline :class="$style.shipButton">{{ shipLabel }}</PrunButton>
          <PrunButton dark inline :class="$style.clearButton" @click="clearShip">×</PrunButton>
        </div>
      </template>
      <div v-else :class="$style.shipPlaceholder" />
    </td>
  </tr>
</template>

<style module>
.row {
  height: 24px;
  border-bottom: 1px solid #2b485a;
  box-sizing: border-box;
}

.planetCell {
  max-width: 30ch;
  font-weight: bold;
  font-size: 12px;
  padding: 0 4px;
  line-height: 22px;
}

.planetLink {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
}

.statusCell {
  width: 44px;
  min-width: 44px;
  box-sizing: border-box;
  white-space: nowrap;
  padding: 2px;
  text-align: center;
  border-left: none;
}

.statusContent {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  box-sizing: border-box;
  padding: 2px 4px;
}

.statusNum {
  min-width: 3ch;
  text-align: center;
}

.toggleCell {
  width: 0;
  padding: 0 1px 0 3px;
  vertical-align: middle;
  border-right: none;
}

.loadCell {
  width: 0;
  white-space: nowrap;
  padding: 0 6px;
  text-align: center;
  color: #f7a600;
}

.shipCell {
  width: 0;
  white-space: nowrap;
  padding: 0 4px;
  vertical-align: middle;
}

.shipCellOver {
  background: #2b485a;
}

.shipPlaceholder {
  border: 1px dashed #444;
  height: 18px;
  width: 74px;
  border-radius: 2px;
  box-sizing: border-box;
}

.shipAssigned {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  width: 74px;
  box-sizing: border-box;
}

.shipButton {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clearButton {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  font-size: 11px;
  padding: 0;
}
</style>
