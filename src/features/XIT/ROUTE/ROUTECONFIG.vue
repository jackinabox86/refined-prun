<script setup lang="ts">
import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import { grip } from '@src/components/grip';
import PrunButton from '@src/components/PrunButton.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import { billTotals } from '@src/features/XIT/DISPATCH/utils';
import {
  departureBill,
  planOriginSegments,
  ownUseByStop,
} from '@src/features/XIT/ROUTE/route-load';
import { buildRouteSpec } from '@src/features/XIT/ROUTE/route-rt';
import { setRouteBlock } from '@src/features/XIT/ROUTE/set-route-gate';
import { buildRouteconfigPackage } from '@src/features/XIT/RTACT/route-package';
import { previewedRtRoute, stagedRtRoute } from '@src/features/XIT/RTACT/staged';
import { routeSummaryLines, type WaitUnit } from '@src/features/XIT/RTACT/route-spec';
import { isStagingHost } from '@src/features/XIT/RTACT/staging-host';
import {
  formatFuelCell,
  fuelCargoLoads,
  maxDaysAtStep,
  paddedLegSeconds,
  planSegmentTanks,
  routeSupplyDays,
  snapDays,
  waitSeconds,
} from '@src/features/XIT/ROUTE/route-calc';
import {
  acceptDroppedStop,
  isLaterOriginVisit,
  originVisitIndexes,
  stopInstanceKey,
} from '@src/features/XIT/ROUTE/route-stops';
import {
  cargoForRouteShip,
  fuelCapacities,
  shipForRoute,
} from '@src/features/XIT/ROUTE/owned-ship';
import {
  createRoute,
  findRoute,
  ROUTE_STOP_MIME,
  shippingRoutes,
} from '@src/features/XIT/ROUTE/routes';
import StopPool from '@src/features/XIT/ROUTE/StopPool.vue';
import { shipOptions } from '@src/features/XIT/TRANSITS/ship-options';
import { useTile } from '@src/hooks/use-tile';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { setBufferSize, showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { RT_ACT_PANE_WIDTH } from '@src/features/XIT/RTACT/rt-stage-layout';
import { vDraggable } from 'vue-draggable-plus';
import { fixed0 } from '@src/utils/format';

interface PoolEntry {
  key: string;
  kind: 'cx' | 'base';
  id: string;
  label: string;
}

const tile = useTile();
const parameters = useXitParameters();
const rtError = ref('');
const staging = isStagingHost(location.hostname);
const selectedId = ref(parameters[0] ?? shippingRoutes()[0]?.id);
const draftName = ref('');
const route = computed(() => findRoute(selectedId.value));
const routes = computed(() => shippingRoutes());

watch(
  () => route.value?.id,
  () => {
    draftName.value = route.value?.name ?? '';
  },
  { immediate: true },
);
const ordered = ref<string[]>([]);
const waitAmount = ref('');
const waitUnit = ref<WaitUnit>('days');

watch(
  () => route.value?.id,
  () => {
    const wait = route.value?.wait;
    waitAmount.value = wait !== undefined && wait.amount > 0 ? String(wait.amount) : '';
    waitUnit.value = wait?.unit ?? 'days';
  },
  { immediate: true },
);

watch(
  () => route.value?.stops.map(stopInstanceKey).join('\n') ?? '',
  () => {
    ordered.value = route.value?.stops.map(stopInstanceKey) ?? [];
  },
  { immediate: true },
);

const dragOptions = {
  ...grip.draggable,
  draggable: 'tbody',
  onEnd: (evt: unknown) => {
    grip.draggable.onEnd?.(evt as never);
    const current = route.value;
    if (current === undefined) {
      return;
    }
    const byKey = new Map(current.stops.map(stop => [stopInstanceKey(stop), stop]));
    const next: UserData.ShippingRouteStop[] = [];
    for (const key of ordered.value) {
      const stop = byKey.get(key);
      if (stop !== undefined) {
        next.push(stop);
      }
    }
    if (current.stops.map(stopInstanceKey).join('\n') !== ordered.value.join('\n')) {
      current.legs = undefined;
    }
    current.stops = next;
  },
};
const dragBinding = [ordered, dragOptions];

const assigned = computed(() => new Set((route.value?.stops ?? []).map(stopKey)));
const cxOnRoute = computed(() => (route.value?.stops ?? []).some(x => x.kind === 'cx'));

const catalog = computed(() => {
  const bases: PoolEntry[] = [];
  for (const site of sitesStore.all.value ?? []) {
    const id = getEntityNaturalIdFromAddress(site.address) ?? '';
    if (id.length === 0) {
      continue;
    }
    bases.push({
      key: stopKey({ kind: 'base', id }),
      kind: 'base',
      id,
      label: getEntityNameFromAddress(site.address) ?? id,
    });
  }
  bases.sort((a, b) => a.label.localeCompare(b.label));
  const exchanges: PoolEntry[] = [];
  for (const exchange of exchangesStore.all.value ?? []) {
    exchanges.push({
      key: stopKey({ kind: 'cx', id: exchange.code }),
      kind: 'cx',
      id: exchange.code,
      label: exchange.code,
    });
  }
  exchanges.sort((a, b) => a.label.localeCompare(b.label));
  return { bases, exchanges };
});

const available = computed(() => {
  const items: PoolEntry[] = [];
  if (!cxOnRoute.value) {
    items.push(...catalog.value.exchanges.filter(x => !assigned.value.has(x.key)));
  }
  items.push(...catalog.value.bases.filter(x => !assigned.value.has(x.key)));
  return items;
});

const assignedBases = computed(() => catalog.value.bases.filter(x => assigned.value.has(x.key)));
const sunkExchanges = computed(() => (cxOnRoute.value ? catalog.value.exchanges : []));

const shipChoices = computed(() => {
  const list = shipOptions();
  const current = route.value?.ship;
  if (current !== undefined && current.length > 0 && !list.some(x => x.value === current)) {
    return [{ value: current, label: current }, ...list];
  }
  return list;
});

const selectedShip = computed(() => shipForRoute(route.value));
const cargo = computed(() => cargoForRouteShip(route.value));
const shipChosen = computed(() => (route.value?.ship?.trim().length ?? 0) > 0);
const canTransit = computed(() => shipChosen.value && (route.value?.stops.length ?? 0) >= 2);

const paddedSeconds = computed(() =>
  sumBy(paddedLegSeconds(route.value?.legs ?? []), seconds => seconds),
);
const durationSeconds = computed(() => paddedSeconds.value + waitSeconds(route.value?.wait));
const supplyDays = computed(() => routeSupplyDays(route.value?.days, durationSeconds.value));
const routeDaysLabel = computed(() => snapDays(durationSeconds.value / 86400).toFixed(1));
const originIndexes = computed(() => originVisitIndexes(route.value?.stops ?? []));

const tanks = computed(() => {
  const current = route.value;
  if (current === undefined) {
    return undefined;
  }
  const ship = selectedShip.value;
  if (ship === undefined) {
    return undefined;
  }
  const caps = fuelCapacities(ship);
  return planSegmentTanks(caps.stl, caps.ftl, current.legs ?? [], originIndexes.value);
});

const fuelLoads = computed(() => {
  const planned = tanks.value;
  if (planned === undefined) {
    return [];
  }
  const parked = originIndexes.value.length > 0 ? originIndexes.value : [0];
  return fuelCargoLoads(planned.stl, planned.ftl, parked);
});

const loadPlan = computed(() => {
  const current = route.value;
  if (current === undefined) {
    return undefined;
  }
  const hold = cargo.value;
  if (hold === undefined) {
    return undefined;
  }
  const segments = planOriginSegments(current.stops, supplyDays.value, fuelLoads.value, hold);
  if (segments === undefined) {
    return undefined;
  }
  return {
    segments,
    billed: segments.flatMap(segment => segment.bases),
  };
});

const overflowIds = computed(() => {
  const ids = new Set<string>();
  for (const segment of loadPlan.value?.segments ?? []) {
    for (const overflow of segment.plan.overflows) {
      if (overflow.stopId === undefined) {
        ids.add('cx-departure');
      } else {
        ids.add(overflow.stopId);
      }
    }
  }
  return ids;
});

const inputTotal = computed(() => {
  let weight = 0;
  let volume = 0;
  for (const base of loadPlan.value?.billed ?? []) {
    const totals = billTotals(base.bill);
    weight += totals.weight;
    volume += totals.volume;
  }
  if (weight === 0 && volume === 0) {
    return '--';
  }
  return `${fixed0(weight)}t / ${fixed0(volume)}m³`;
});

function stopKey(stop: { kind: 'cx' | 'base'; id: string }) {
  return `${stop.kind}:${stop.id}`;
}

function parseStopKey(key: string): UserData.ShippingRouteStop | undefined {
  const split = key.indexOf(':');
  if (split <= 0) {
    return undefined;
  }
  const kind = key.slice(0, split);
  const id = key.slice(split + 1);
  if ((kind !== 'cx' && kind !== 'base') || id.length === 0) {
    return undefined;
  }
  return { kind, id };
}

function labelFor(stop: UserData.ShippingRouteStop) {
  if (stop.kind === 'cx') {
    return stop.id;
  }
  const site = sitesStore.getByPlanetNaturalId(stop.id);
  if (site === undefined) {
    return stop.id;
  }
  return getEntityNameFromAddress(site.address) ?? stop.id;
}

function rowStops() {
  const current = route.value;
  if (current === undefined) {
    return [];
  }
  const byKey = new Map(current.stops.map(stop => [stopInstanceKey(stop), stop]));
  return ordered.value
    .map(key => byKey.get(key))
    .filter((stop): stop is UserData.ShippingRouteStop => stop !== undefined);
}

function segmentAt(index: number) {
  let found = loadPlan.value?.segments[0];
  for (const segment of loadPlan.value?.segments ?? []) {
    if (segment.originIndex <= index) {
      found = segment;
    }
  }
  return found;
}

function inputRecord(stop: UserData.ShippingRouteStop, index: number) {
  const planned = loadPlan.value;
  const stops = route.value?.stops ?? [];
  if (planned === undefined) {
    return undefined;
  }
  if (isLaterOriginVisit(stops, index)) {
    const segment = segmentAt(index);
    if (segment === undefined) {
      return undefined;
    }
    return departureBill(segment.bases, segment.plan.sourced, segment.plan.departureExtra);
  }
  if (stop.kind === 'base') {
    return planned.billed.find(x => x.naturalId === stop.id)?.bill;
  }
  const firstCx = stops.findIndex(x => x.kind === 'cx');
  if (firstCx !== index) {
    return undefined;
  }
  const segment = segmentAt(index);
  if (segment === undefined) {
    return undefined;
  }
  return departureBill(segment.bases, segment.plan.sourced, segment.plan.departureExtra);
}

function outputRecord(stop: UserData.ShippingRouteStop) {
  if (stop.kind !== 'base') {
    return undefined;
  }
  for (const segment of loadPlan.value?.segments ?? []) {
    const record = segment.plan.loadedByStop.get(stop.id);
    if (record !== undefined) {
      return record;
    }
  }
  return undefined;
}

function loadText(record: Record<string, number> | undefined) {
  if (record === undefined || Object.keys(record).length === 0) {
    return '--';
  }
  const totals = billTotals(record);
  return `${fixed0(totals.weight)}t / ${fixed0(totals.volume)}m³`;
}

function inputOver(stop: UserData.ShippingRouteStop, index: number) {
  const hold = cargo.value;
  const record = inputRecord(stop, index);
  if (hold === undefined || record === undefined) {
    return false;
  }
  const totals = billTotals(record);
  return totals.weight > hold.weightCapacity || totals.volume > hold.volumeCapacity;
}

const rtTooltip = computed(() =>
  setRouteBlock({
    staging,
    shipChosen: shipChosen.value,
    stopCount: route.value?.stops.length ?? 0,
    billReady: loadPlan.value !== undefined && tanks.value !== undefined,
    legs: route.value?.legs,
    supplyDays: supplyDays.value,
    hasOverflow: (loadPlan.value?.segments ?? []).some(
      segment => segment.plan.overflows.length > 0,
    ),
    inputOverloaded: rowStops().some((stop, index) => inputOver(stop, index)),
  }),
);

const canBuildRt = computed(() => rtTooltip.value === undefined);

// Off staging, PREVIEW arms on the same checks SET ROUTE would pass there.
const previewTooltip = computed(() => {
  const block = setRouteBlock({
    staging: true,
    shipChosen: shipChosen.value,
    stopCount: route.value?.stops.length ?? 0,
    billReady: loadPlan.value !== undefined && tanks.value !== undefined,
    legs: route.value?.legs,
    supplyDays: supplyDays.value,
    hasOverflow: (loadPlan.value?.segments ?? []).some(
      segment => segment.plan.overflows.length > 0,
    ),
    inputOverloaded: rowStops().some((stop, index) => inputOver(stop, index)),
  });
  return block?.replace('build the route', 'preview the route');
});

const canPreviewRt = computed(() => previewTooltip.value === undefined);

function outputOver(stop: UserData.ShippingRouteStop) {
  return stop.kind === 'base' && overflowIds.value.has(stop.id);
}

function fuelText(index: number) {
  const planned = tanks.value;
  if (planned === undefined) {
    return '--';
  }
  return formatFuelCell(planned.stl[index], planned.ftl[index]);
}

function onCreate() {
  const created = createRoute();
  selectedId.value = created.id;
}

function onSelect(event: Event) {
  selectedId.value = (event.target as HTMLSelectElement).value;
}

function onRename() {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  const name = draftName.value.trim();
  if (name.length === 0) {
    draftName.value = current.name;
    return;
  }
  current.name = name;
}

function onLoop(on: boolean | undefined) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  current.loop = on === true;
}

function setDays(days: number) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  current.days = snapDays(days);
}

function onDaysChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const parsed = Number(input.value);
  const clamped = snapDays(Number.isFinite(parsed) ? parsed : 0);
  setDays(clamped);
  input.value = clamped.toFixed(1);
}

function onFit() {
  const current = route.value;
  const hold = cargo.value;
  if (current === undefined || hold === undefined) {
    return;
  }
  if (planOriginSegments(current.stops, supplyDays.value, fuelLoads.value, hold) === undefined) {
    return;
  }
  current.days = maxDaysAtStep(days => {
    const segments = planOriginSegments(current.stops, days, fuelLoads.value, hold);
    if (segments === undefined) {
      return false;
    }
    return segments.every(segment => segment.plan.fits);
  });
}

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes(ROUTE_STOP_MIME)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'copy';
}

function onDrop(event: DragEvent) {
  const key = event.dataTransfer?.getData(ROUTE_STOP_MIME) ?? '';
  if (key.length === 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const parsed = parseStopKey(key);
  const current = route.value;
  if (parsed === undefined || current === undefined) {
    return;
  }
  const accepted = acceptDroppedStop(current.stops, parsed);
  if (accepted === undefined) {
    return;
  }
  setTimeout(() => {
    current.stops.push(accepted);
    current.legs = undefined;
  }, 0);
}

function removeStop(key: string) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  current.stops = current.stops.filter(x => stopInstanceKey(x) !== key);
  current.legs = undefined;
}

function onWaitDraft(event: Event) {
  waitAmount.value = (event.target as HTMLInputElement).value;
}

function onWaitUnit(event: Event) {
  const unit = (event.target as HTMLSelectElement).value;
  if (unit === 'seconds' || unit === 'minutes' || unit === 'hours' || unit === 'days') {
    waitUnit.value = unit;
  }
}

function onWait() {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  const amount = Number(waitAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    current.wait = undefined;
    waitAmount.value = '';
    return;
  }
  current.wait = { amount, unit: waitUnit.value };
}

// Exchange codes (AI1) are not suggestion text. The station name is.
function waypointQuery(stop: { kind: 'cx' | 'base'; id: string }) {
  if (stop.kind !== 'cx') {
    return stop.id;
  }
  return getEntityNameFromAddress(exchangesStore.getByCode(stop.id)?.address) ?? stop.id;
}

function routeSpecForRt() {
  const current = route.value;
  const planned = loadPlan.value;
  const plannedTanks = tanks.value;
  if (current === undefined || planned === undefined || plannedTanks === undefined) {
    return undefined;
  }
  const first = planned.segments[0];
  if (first === undefined) {
    return undefined;
  }
  const multi = planned.segments.length > 1;
  const built = buildRouteSpec({
    stops: current.stops.map(stop => ({
      kind: stop.kind,
      id: stop.id,
      query: waypointQuery(stop),
    })),
    loop: current.loop,
    legs: current.legs,
    bills: first.bases.map(base => ({ id: base.naturalId, bill: base.bill })),
    sourced: first.plan.sourced,
    loadedByStop: first.plan.loadedByStop,
    ownUseByStop: ownUseByStop(first.bases),
    departureExtra: first.plan.departureExtra,
    refuelStl: plannedTanks.stl.map(stop => stop.refuel),
    refuelFtl: plannedTanks.ftl.map(stop => stop.refuel),
    segments: multi
      ? planned.segments.map(segment => ({
          originIndex: segment.originIndex,
          bills: segment.bases.map(base => ({ id: base.naturalId, bill: base.bill })),
          sourced: segment.plan.sourced,
          loadedByStop: segment.plan.loadedByStop,
          ownUseByStop: ownUseByStop(segment.bases),
          departureExtra: segment.plan.departureExtra,
        }))
      : undefined,
    wait: current.wait,
  });
  if (!built.ok) {
    rtError.value = built.error;
    return undefined;
  }
  return built.spec;
}

function onBuildRt() {
  const current = route.value;
  if (current === undefined || !canBuildRt.value) {
    return;
  }
  const spec = routeSpecForRt();
  if (spec === undefined) {
    return;
  }
  const pkg = buildRouteconfigPackage(
    location.hostname,
    spec,
    current.ship ?? '',
    current.name,
    current.id,
  );
  if (!pkg.ok) {
    rtError.value = pkg.error;
    return;
  }
  rtError.value = '';
  stagedRtRoute.value = { pkg: pkg.pkg };
  if (!dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, null))) {
    showBuffer('XIT RTEXEC');
    return;
  }
  // RTEXEC takes over this window, and the runner's split adds a pane to its width.
  // Start from the log pane's width instead of the much wider ROUTECONFIG table, and keep
  // this window's height: the RT stage grows it only once the RT tile is in.
  if (tile.container.classList.contains(C.Window.body)) {
    const height = parseInt(tile.container.style.height, 10);
    setBufferSize(
      tile.id,
      RT_ACT_PANE_WIDTH,
      Number.isNaN(height) ? tile.container.offsetHeight : height,
    );
  }
  dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(tile.id, 'XIT RTEXEC'));
}

function onPreviewRt() {
  const current = route.value;
  if (current === undefined || !canPreviewRt.value) {
    return;
  }
  const spec = routeSpecForRt();
  if (spec === undefined) {
    return;
  }
  rtError.value = '';
  previewedRtRoute.value = {
    name: current.name,
    lines: routeSummaryLines(spec, current.ship ?? undefined),
  };
  showBuffer('XIT RTPREVIEW');
}

function openTransits() {
  const current = route.value;
  if (current === undefined || !canTransit.value) {
    return;
  }
  showBuffer(`XIT TRANSITS ${current.id}`);
}

function selectShip(event: Event) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  const registration = (event.target as HTMLSelectElement).value.trim();
  current.ship = registration.length > 0 ? registration : undefined;
}
</script>

<template>
  <div :class="$style.layout">
    <div :class="[C.ComExOrdersPanel.filter, $style.bar]">
      <select :class="$style.select" :value="selectedId ?? ''" @change="onSelect">
        <option value="" disabled>Route</option>
        <option v-for="item in routes" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <PrunButton dark @click="onCreate">NEW</PrunButton>
      <template v-if="route">
        <input v-model="draftName" :class="$style.name" />
        <PrunButton dark @click="onRename">RENAME</PrunButton>
        <div :class="$style.separator" />
        <span :class="$style.daysLabel">Ship</span>
        <select :class="$style.select" :value="route.ship ?? ''" @change="selectShip">
          <option value="" disabled>Ship</option>
          <option v-for="option in shipChoices" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <span :class="$style.daysLabel">Supply Days</span>
        <input
          :class="$style.days"
          type="number"
          step="0.1"
          min="0"
          max="999"
          :value="supplyDays.toFixed(1)"
          @change="onDaysChange" />
        <PrunButton dark :disabled="selectedShip === undefined" @click="onFit">FIT</PrunButton>
        <span :class="$style.daysLabel">Route {{ routeDaysLabel }}d</span>
        <RadioItem
          :class="$style.loop"
          :model-value="route.loop !== false"
          horizontal
          @update:model-value="onLoop">
          LOOP
        </RadioItem>
      </template>
    </div>
    <p v-if="route === undefined" :class="$style.note">Create a route to order its stops.</p>
    <div v-else :class="$style.panes">
      <StopPool :available="available" :assigned="assignedBases" :exchanges="sunkExchanges" />
      <div :class="$style.route" @dragenter="onDragOver" @dragover="onDragOver" @drop="onDrop">
        <div :class="$style.routeBody">
          <table v-draggable="dragBinding" :class="$style.table">
            <thead>
              <tr>
                <GripHeaderCell />
                <th>Stop</th>
                <th />
                <th>Input</th>
                <th>Output</th>
                <th>Fuel</th>
              </tr>
            </thead>
            <tbody v-for="(stop, index) in rowStops()" :key="stopInstanceKey(stop)">
              <tr>
                <GripCell />
                <td>{{ labelFor(stop) }}</td>
                <td>
                  <PrunButton dark inline @click="removeStop(stopInstanceKey(stop))">×</PrunButton>
                </td>
                <td>
                  <span :class="[inputOver(stop, index) && C.Workforces.daysMissing, $style.load]">
                    {{ loadText(inputRecord(stop, index)) }}
                  </span>
                </td>
                <td>
                  <span :class="[outputOver(stop) && C.Workforces.daysMissing, $style.load]">
                    {{ loadText(outputRecord(stop)) }}
                  </span>
                </td>
                <td>{{ fuelText(index) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>Total</td>
                <td />
                <td>{{ inputTotal }}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
          <div :class="$style.wait">
            <PrunButton dark @click="onWait">WAIT</PrunButton>
            <input
              :class="$style.days"
              type="number"
              min="0"
              step="any"
              :value="waitAmount"
              @change="onWaitDraft" />
            <select :class="$style.select" :value="waitUnit" @change="onWaitUnit">
              <option value="days">days</option>
              <option value="hours">hours</option>
              <option value="minutes">minutes</option>
              <option value="seconds">seconds</option>
            </select>
          </div>
          <p v-if="rtError" :class="$style.note">{{ rtError }}</p>
          <div :class="$style.footer">
            <span>Press to Determine Flight Times.</span>
            <span
              :class="$style.transitsGate"
              :data-tooltip="shipChosen ? undefined : 'Set a ship above to determine flight times.'"
              data-tooltip-position="left">
              <PrunButton :primary="canTransit" :disabled="!canTransit" @click="openTransits">
                TRANSITS
              </PrunButton>
            </span>
            <span
              :class="$style.transitsGate"
              :data-tooltip="rtTooltip"
              data-tooltip-position="left">
              <PrunButton :primary="canBuildRt" :disabled="!canBuildRt" @click="onBuildRt">
                SET ROUTE
              </PrunButton>
            </span>
            <span
              v-if="!staging"
              :class="$style.transitsGate"
              :data-tooltip="previewTooltip"
              data-tooltip-position="left">
              <PrunButton :primary="canPreviewRt" :disabled="!canPreviewRt" @click="onPreviewRt">
                PREVIEW
              </PrunButton>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style module>
.layout {
  display: flex;
  flex-direction: column;
}

.bar {
  flex-wrap: wrap;
  gap: 4px;
}

.select,
.name,
.days {
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  background: transparent;
  border: none;
  border-bottom: 1px solid #8d6411;
}

.name {
  width: 12ch;
}

.days {
  width: 6ch;
}

.daysLabel {
  margin-left: 4px;
}

.separator {
  width: 1px;
  align-self: stretch;
  background-color: #2b485a;
  margin: 0 0.25rem;
}

/* No inner scroller: the game's ScrollView scrolls the tile, as in DISPATCH. */
.panes {
  display: flex;
  flex-direction: row;
}

.route {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px;
}

.routeBody {
  display: inline-block;
}

.table {
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 2px 6px;
  white-space: nowrap;
  text-align: center;
  border-bottom: 1px solid #2b485a;
}

.load {
  padding: 2px 4px;
}

/* A disabled button swallows hover, so let the tooltip wrapper receive it. */
.transitsGate button:disabled {
  pointer-events: none;
}

.wait {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 0;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
}

.loop {
  margin-left: auto;
}

.note {
  margin: 8px;
}
</style>
