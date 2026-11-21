<script setup lang="ts">
import { computed } from 'vue';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';
import { displaytimeBetween, hhmm } from '@src/utils/format';
import { timestampEachMinute } from '@src/utils/dayjs';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getInvStore } from '@src/core/store-id';
import {
  getLocationLineFromAddress,
  isStationLine,
} from '@src/infrastructure/prun-api/data/addresses';
import { resolveFltButtonColor } from './button-colors';
import { getFltRouteIndicatorColor, getFltRouteLabel } from './route-indicator';

const props = defineProps<{
  shipId: string;
}>();

const ship = computed(() => shipsStore.getById(props.shipId));
const flight = computed(() => flightsStore.getById(ship.value?.flightId));
const inventory = computed(() => getInvStore(ship.value?.idShipStore));
const route = computed(() => shipRoutesStore.getByShipId(props.shipId));
const routeIndicatorColor = computed(() => getFltRouteIndicatorColor(route.value?.state));
const routeLabel = computed(() => getFltRouteLabel(route.value?.route));

const timeData = computed(() => {
  const arrival = flight.value?.arrival.timestamp;
  if (arrival == null || Number.isNaN(arrival)) {
    return null;
  }
  return {
    relative: displaytimeBetween(timestampEachMinute.value, arrival),
    absolute: hhmm(arrival),
  };
});

const hasItems = computed(() => (inventory.value?.items.length ?? 0) > 0);

const isAtCx = computed(() =>
  isStationLine(getLocationLineFromAddress(ship.value?.address ?? undefined)),
);

const unloadBtnColor = computed(() => resolveFltButtonColor(isAtCx.value, hasItems.value));
</script>

<template>
  <div :class="$style.container">
    <template v-if="timeData">
      <div :class="$style.timeColumn" @click.stop="showBuffer(`SFC ${ship?.registration}`)">
        <div :class="$style.countdownRow">
          <span
            v-if="routeIndicatorColor"
            :class="$style.routeDot"
            :style="{ backgroundColor: routeIndicatorColor }"
            :data-tooltip="routeLabel"
            data-tooltip-position="top" />
          <span style="color: #99d5ff">{{ timeData.relative }}</span>
        </div>
        <span style="color: #888">({{ timeData.absolute }})</span>
      </div>
    </template>
    <template v-else>
      <div :class="$style.actions">
        <span
          v-if="routeIndicatorColor"
          :class="$style.routeDot"
          :style="{ backgroundColor: routeIndicatorColor }"
          :data-tooltip="routeLabel"
          data-tooltip-position="top" />
        <span
          :class="$style.actionBtn"
          :style="{ paddingRight: '5px', backgroundColor: unloadBtnColor }"
          @click.stop="showBuffer(`SHPI ${ship?.registration}`)">
          {{ hasItems ? '⭱' : '⭳' }}
        </span>
        <span
          :class="[$style.actionBtn, $style.bgGreen]"
          @click.stop="showBuffer(`SFC ${ship?.registration}`)">
          ✈
        </span>
      </div>
    </template>
  </div>
</template>

<style module>
.container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  cursor: pointer;
}

.timeColumn {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.countdownRow {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.routeDot {
  display: inline-block;
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  flex-shrink: 0;
}

.actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.actionBtn {
  font-size: 15px;
  height: 20px;
  width: 20px;
  padding: 2px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  color: white;
}

.bgGreen {
  background-color: #5cb85c;
}
</style>
