<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import Header from '@src/components/Header.vue';
import PrunButton from '@src/components/PrunButton.vue';
import Active from '@src/components/forms/Active.vue';
import { transitStopIds } from '@src/features/XIT/ROUTE/route-calc';
import { ownedShipOfSize } from '@src/features/XIT/ROUTE/owned-ship';
import { findRoute } from '@src/features/XIT/ROUTE/routes';
import { shipOptions } from '@src/features/XIT/TRANSITS/ship-options';
import { stopLines } from '@src/features/XIT/TRANSITS/plan-route';
import { routeResults } from '@src/features/XIT/TRANSITS/route-results';
import { stagedRoute } from '@src/features/XIT/TRANSITS/staged';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';
import { useTile } from '@src/hooks/use-tile';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const tile = useTile();
useMinBufferHeight();

const parameters = useXitParameters();
const shipRegistration = ref('');
const routeStops = ref('');
const formError = ref('');
const options = computed(() => shipOptions());
let appliedStops = false;
let appliedShip = false;

watch(
  options,
  list => {
    const routeId = parameters[0];
    routeResults.routeId = routeId;
    if (routeId !== undefined) {
      const route = findRoute(routeId);
      if (route !== undefined) {
        if (!appliedStops) {
          routeStops.value = transitStopIds(route.stops, route.loop).join('\n');
          appliedStops = true;
        }
        if (!appliedShip) {
          const named = route.ship?.trim() ?? '';
          const fromSize =
            named.length > 0 ? '' : (ownedShipOfSize(route.shipSize)?.registration.trim() ?? '');
          const registration = named.length > 0 ? named : fromSize;
          const listed = registration.length > 0 && list.some(x => x.value === registration);
          const waiting =
            list.length === 0 ||
            (registration.length === 0 && (named.length > 0 || route.shipSize !== undefined));
          if (listed) {
            shipRegistration.value = registration;
            appliedShip = true;
          } else if (!waiting) {
            appliedShip = true;
          }
        }
      } else {
        appliedStops = true;
        appliedShip = true;
      }
    } else {
      appliedStops = true;
      appliedShip = true;
    }
    if (!appliedShip) {
      return;
    }
    if (list.some(x => x.value === shipRegistration.value)) {
      return;
    }
    shipRegistration.value = list[0]?.value ?? '';
  },
  { immediate: true },
);

// ROUTECONFIG can change the route's ship while this buffer stays open.
watch(
  () => findRoute(parameters[0])?.ship?.trim(),
  ship => {
    if (ship !== undefined && options.value.some(x => x.value === ship)) {
      shipRegistration.value = ship;
    }
  },
);

const lines = computed(() => stopLines(routeStops.value));
const canTest = computed(() => shipRegistration.value.length > 0 && lines.value.length >= 2);

function onTest() {
  routeResults.routeId = parameters[0];
  formError.value = '';
  if (!canTest.value) {
    formError.value = 'Choose a ship and enter at least two stops';
    return;
  }
  stagedRoute.value = {
    global: { name: 'Transits' },
    groups: [],
    actions: [
      {
        type: 'Transits',
        name: 'Route',
        shipRegistration: shipRegistration.value,
        routeStops: routeStops.value,
      },
    ],
  };
  if (!dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, null))) {
    showBuffer('XIT TRANSITSACT');
    return;
  }
  dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, 'XIT TRANSITSACT'));
}
</script>

<template>
  <div :class="$style.root">
    <Header>Transits</Header>
    <form :class="$style.form" @submit.prevent="onTest">
      <p v-if="options.length === 0" :class="$style.note">No ships loaded.</p>
      <Active v-else label="Ship">
        <select v-model="shipRegistration" :class="$style.select">
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </Active>
      <Active label="Stops">
        <textarea
          v-model="routeStops"
          :class="$style.textarea"
          placeholder="One planet or commodity exchange per line&#10;Hortus a&#10;ANT"
          spellcheck="false" />
      </Active>
      <p v-if="formError" :class="$style.error">{{ formError }}</p>
      <p :class="$style.note">
        Runs each leg through that ship's blueprint test flight. Each leg waits so its fuel usage
        and gateway can be set, starting from the previous leg's choices. Tanks burn down from the
        first leg's loadout. Does not delete a blueprint.
      </p>
      <ActionBar>
        <PrunButton primary :disabled="!canTest" @click="onTest">Set Flight Preferences</PrunButton>
      </ActionBar>
    </form>
  </div>
</template>

<style module>
.root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  margin: 5px 0 0 4px;
}

.select,
.textarea {
  width: 100%;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  background: transparent;
  border: none;
}

.textarea {
  min-height: 96px;
  resize: vertical;
}

.select:focus,
.textarea:focus {
  outline: none;
}

.note {
  margin: 4px 0 0 5px;
}

.error {
  margin: 4px 0 0 5px;
  color: var(--rp-color-red);
}
</style>
