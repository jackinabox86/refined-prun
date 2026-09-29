<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import Header from '@src/components/Header.vue';
import PrunButton from '@src/components/PrunButton.vue';
import Active from '@src/components/forms/Active.vue';
import { validBlueprintOptions } from '@src/features/XIT/ROUTE/blueprint-options';
import { planRouteLegs, stopLines } from '@src/features/XIT/ROUTE/plan-route';
import { resolveRouteStop } from '@src/features/XIT/ROUTE/resolve-route-stop';
import { stagedRoute } from '@src/features/XIT/ROUTE/staged';
import { useMinBufferHeight } from '@src/hooks/use-min-buffer-height';
import { useTile } from '@src/hooks/use-tile';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const tile = useTile();
useMinBufferHeight();

const blueprintNaturalId = ref('');
const routeStops = ref('');
const formError = ref('');
const options = computed(() => validBlueprintOptions());

watch(
  options,
  list => {
    if (list.some(x => x.value === blueprintNaturalId.value)) {
      return;
    }
    blueprintNaturalId.value = list[0]?.value ?? '';
  },
  { immediate: true },
);

const lines = computed(() => stopLines(routeStops.value));
const canTest = computed(() => blueprintNaturalId.value.length > 0 && lines.value.length >= 2);

const preview = computed(() => {
  if (lines.value.length < 2) {
    return '';
  }
  const planned = planRouteLegs(lines.value.map(x => resolveRouteStop(x)));
  if (planned.error !== undefined) {
    return planned.error;
  }
  return planned.legs
    .map(x =>
      x.error === undefined
        ? `${x.originLabel} → ${x.destinationLabel}`
        : `${x.originLabel} → ${x.destinationLabel}: ${x.error}`,
    )
    .join('\n');
});

function onTest() {
  formError.value = '';
  if (!canTest.value) {
    formError.value = 'Choose a VALID blueprint and enter at least two stops';
    return;
  }
  stagedRoute.value = {
    global: { name: 'Route flight test' },
    groups: [],
    actions: [
      {
        type: 'Route Test',
        name: 'Route',
        blueprintNaturalId: blueprintNaturalId.value,
        routeStops: routeStops.value,
      },
    ],
  };
  if (!dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, null))) {
    showBuffer('XIT ROUTEACT');
    return;
  }
  dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, 'XIT ROUTEACT'));
}
</script>

<template>
  <div :class="$style.root">
    <Header>Route flight test</Header>
    <form :class="$style.form" @submit.prevent="onTest">
      <p v-if="options.length === 0" :class="$style.note">
        No VALID blueprint. Locked blueprints do not compute a test flight.
      </p>
      <Active v-else label="Blueprint">
        <select v-model="blueprintNaturalId" :class="$style.select">
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
      <pre v-if="preview" :class="$style.preview">{{ preview }}</pre>
      <p v-if="formError" :class="$style.error">{{ formError }}</p>
      <p :class="$style.note">
        Runs each leg through that blueprint's test flight. Does not delete a blueprint.
      </p>
      <ActionBar>
        <PrunButton primary :disabled="!canTest" @click="onTest">Test route</PrunButton>
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

.preview {
  margin: 4px 0 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 11px;
}

.note {
  margin: 4px 0 0 5px;
}

.error {
  margin: 4px 0 0 5px;
  color: var(--rp-color-red);
}
</style>
