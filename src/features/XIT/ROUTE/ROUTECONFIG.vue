<script setup lang="ts">
import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import { grip } from '@src/components/grip';
import PrunButton from '@src/components/PrunButton.vue';
import { shipSizes, shipSizesOwnedByFleet } from '@src/core/ship-sizes';
import { billTotals } from '@src/features/XIT/DISPATCH/utils';
import { departureBill, planRouteLoads, routeBaseBills } from '@src/features/XIT/ROUTE/route-load';
import {
  formatFuelCell,
  fuelCargoLoads,
  maxDaysAtStep,
  paddedLegSeconds,
  planRouteTanks,
  routeSupplyDays,
  snapDays,
} from '@src/features/XIT/ROUTE/route-calc';
import { cargoForRoute, fuelCapacities, ownedShipOfSize } from '@src/features/XIT/ROUTE/owned-ship';
import {
  createRoute,
  findRoute,
  removeRoute,
  ROUTE_STOP_MIME,
  shippingRoutes,
} from '@src/features/XIT/ROUTE/routes';
import StopPool from '@src/features/XIT/ROUTE/StopPool.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { vDraggable } from 'vue-draggable-plus';
import { fixed0 } from '@src/utils/format';

interface PoolEntry {
  key: string;
  kind: 'cx' | 'base';
  id: string;
  label: string;
}

const parameters = useXitParameters();
const selectedId = ref(parameters[0]);
const route = computed(() => findRoute(selectedId.value));
const routes = computed(() => shippingRoutes());
const ordered = ref<string[]>([]);

watch(
  () => route.value?.stops.map(stopKey).join('\n') ?? '',
  () => {
    ordered.value = route.value?.stops.map(stopKey) ?? [];
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
    const next: UserData.ShippingRouteStop[] = [];
    for (const key of ordered.value) {
      const parsed = parseStopKey(key);
      if (parsed !== undefined) {
        next.push(parsed);
      }
    }
    if (current.stops.map(stopKey).join('\n') !== ordered.value.join('\n')) {
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
  const items = catalog.value.bases.filter(x => !assigned.value.has(x.key));
  if (!cxOnRoute.value) {
    items.push(...catalog.value.exchanges.filter(x => !assigned.value.has(x.key)));
  }
  return items;
});

const sunk = computed(() => {
  const items = catalog.value.bases.filter(x => assigned.value.has(x.key));
  if (cxOnRoute.value) {
    items.push(...catalog.value.exchanges);
  }
  return items;
});

const sizeChoices = computed(() => {
  const owned = shipSizesOwnedByFleet(shipSizes, shipsStore.all.value, id =>
    storagesStore.getById(id),
  );
  const current = route.value?.shipSize;
  if (current !== undefined && !owned.some(x => x.id === current)) {
    const stored = shipSizes.find(x => x.id === current);
    if (stored !== undefined) {
      return [...owned, stored];
    }
  }
  return owned;
});

const paddedSeconds = computed(() =>
  sumBy(paddedLegSeconds(route.value?.legs ?? []), seconds => seconds),
);
const supplyDays = computed(() => routeSupplyDays(route.value?.days, paddedSeconds.value));
const routeDaysLabel = computed(() => snapDays(paddedSeconds.value / 86400).toFixed(1));

const tanks = computed(() => {
  const current = route.value;
  if (current === undefined) {
    return undefined;
  }
  const ship = ownedShipOfSize(current.shipSize);
  if (ship === undefined) {
    return undefined;
  }
  const caps = fuelCapacities(ship);
  return planRouteTanks(caps.stl, caps.ftl, current.legs ?? []);
});

const fuelLoads = computed(() => {
  const planned = tanks.value;
  if (planned === undefined) {
    return [];
  }
  return fuelCargoLoads(planned.stl, planned.ftl);
});

const loadPlan = computed(() => {
  const current = route.value;
  if (current === undefined) {
    return undefined;
  }
  const cargo = cargoForRoute(current.shipSize);
  if (cargo === undefined) {
    return undefined;
  }
  const billed = routeBaseBills(current.stops, supplyDays.value, fuelLoads.value);
  if (billed === undefined) {
    return undefined;
  }
  return {
    billed,
    plan: planRouteLoads(billed, cargo),
  };
});

const overflowIds = computed(() => {
  const ids = new Set<string>();
  for (const overflow of loadPlan.value?.plan.overflows ?? []) {
    if (overflow.stopId === undefined) {
      ids.add('cx-departure');
    } else {
      ids.add(overflow.stopId);
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
  return ordered.value
    .map(parseStopKey)
    .filter((stop): stop is UserData.ShippingRouteStop => stop !== undefined);
}

function inputRecord(stop: UserData.ShippingRouteStop, index: number) {
  const planned = loadPlan.value;
  if (planned === undefined) {
    return undefined;
  }
  if (stop.kind === 'base') {
    return planned.billed.find(x => x.naturalId === stop.id)?.bill;
  }
  const firstCx = route.value?.stops.findIndex(x => x.kind === 'cx') ?? -1;
  if (firstCx !== index) {
    return undefined;
  }
  return departureBill(planned.billed, planned.plan.sourced);
}

function outputRecord(stop: UserData.ShippingRouteStop) {
  if (stop.kind !== 'base') {
    return undefined;
  }
  return loadPlan.value?.plan.loadedByStop.get(stop.id);
}

function loadText(record: Record<string, number> | undefined) {
  if (record === undefined || Object.keys(record).length === 0) {
    return '--';
  }
  const totals = billTotals(record);
  return `${fixed0(totals.weight)}t / ${fixed0(totals.volume)}m³`;
}

function rowOver(stop: UserData.ShippingRouteStop, index: number) {
  if (stop.kind === 'cx') {
    const firstCx = route.value?.stops.findIndex(x => x.kind === 'cx') ?? -1;
    return firstCx === index && overflowIds.value.has('cx-departure');
  }
  return overflowIds.value.has(stop.id);
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

function onName(event: Event) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  const name = (event.target as HTMLInputElement).value.trim();
  current.name = name.length > 0 ? name : current.name;
}

function onRemove() {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  removeRoute(current.id);
  selectedId.value = shippingRoutes()[0]?.id;
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

function stepDays(direction: number) {
  setDays(supplyDays.value + direction * 0.1);
}

function onFit() {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  const cargo = cargoForRoute(current.shipSize);
  if (cargo === undefined) {
    return;
  }
  if (routeBaseBills(current.stops, supplyDays.value, fuelLoads.value) === undefined) {
    return;
  }
  current.days = maxDaysAtStep(days => {
    const billed = routeBaseBills(current.stops, days, fuelLoads.value);
    if (billed === undefined) {
      return false;
    }
    return planRouteLoads(billed, cargo).fits;
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
  if (current.stops.some(x => stopKey(x) === key)) {
    return;
  }
  setTimeout(() => {
    current.stops.push(parsed);
    current.legs = undefined;
  }, 0);
}

function removeStop(key: string) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  current.stops = current.stops.filter(x => stopKey(x) !== key);
  current.legs = undefined;
}

function openTransits() {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  showBuffer(`XIT TRANSITS ${current.id}`);
}

function selectSize(id: string) {
  const current = route.value;
  if (current === undefined) {
    return;
  }
  current.shipSize = id;
}
</script>

<template>
  <div :class="$style.layout">
    <div :class="[C.ComExOrdersPanel.filter, $style.bar]">
      <select :class="$style.select" :value="selectedId ?? ''" @change="onSelect">
        <option value="" disabled>Route</option>
        <option v-for="item in routes" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <PrunButton primary @click="onCreate">NEW</PrunButton>
      <template v-if="route">
        <input :class="$style.name" :value="route.name" @change="onName" />
        <PrunButton dark @click="onRemove">REMOVE</PrunButton>
        <div :class="$style.separator" />
        <PrunButton
          v-for="size in sizeChoices"
          :key="size.id"
          :primary="route.shipSize === size.id"
          :dark="route.shipSize !== size.id"
          @click="selectSize(size.id)">
          {{ size.label }}
        </PrunButton>
        <span :class="$style.daysLabel">Days</span>
        <button type="button" :class="$style.step" @click="stepDays(-1)">−</button>
        <input
          :class="$style.days"
          type="number"
          step="0.1"
          min="0"
          max="999"
          :value="supplyDays.toFixed(1)"
          @change="onDaysChange" />
        <button type="button" :class="$style.step" @click="stepDays(1)">+</button>
        <PrunButton primary :disabled="route.shipSize === undefined" @click="onFit">FIT</PrunButton>
        <span :class="$style.daysLabel">Route {{ routeDaysLabel }}d</span>
      </template>
    </div>
    <p v-if="route === undefined" :class="$style.note">Create a route to order its stops.</p>
    <div v-else :class="$style.panes">
      <StopPool :available="available" :sunk="sunk" />
      <div :class="$style.route" @dragenter="onDragOver" @dragover="onDragOver" @drop="onDrop">
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
          <tbody v-for="(stop, index) in rowStops()" :key="stopKey(stop)">
            <tr>
              <GripCell />
              <td>{{ labelFor(stop) }}</td>
              <td>
                <PrunButton dark inline @click="removeStop(stopKey(stop))">×</PrunButton>
              </td>
              <td>
                <span :class="[rowOver(stop, index) && C.Workforces.daysMissing, $style.load]">
                  {{ loadText(inputRecord(stop, index)) }}
                </span>
              </td>
              <td>
                <span :class="[rowOver(stop, index) && C.Workforces.daysMissing, $style.load]">
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
        <PrunButton primary :class="$style.transits" @click="openTransits">TRANSITS</PrunButton>
      </div>
    </div>
  </div>
</template>

<style module>
.layout {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.bar {
  flex-wrap: wrap;
  gap: 4px;
}

.select,
.name,
.days,
.step {
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

.panes {
  display: flex;
  flex-direction: row;
}

.route {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px;
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

.transits {
  margin-top: 8px;
}

.note {
  margin: 8px;
}
</style>
