<script setup lang="ts">
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { getMaterialCategoryCssClass } from '@src/infrastructure/prun-ui/item-tracker';
import { materialCategoriesStore } from '@src/infrastructure/prun-api/data/material-categories';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { fixed02 } from '@src/utils/format';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const props = defineProps<{
  naturalId: string;
}>();

const $style = useCssModule();

interface Segment {
  name: string;
  class: string;
  borderClasses?: string[];
  width: string;
  title: string;
}

interface ShipBarData {
  id: string;
  displayName: string;
  storeCmd: string;
  segments: Segment[];
  miniMode: boolean;
  stripeColor: string;
  stripeWidth: string;
}

const shipBars = computed<ShipBarData[]>(() => {
  const ships = shipsStore.all.value;
  const allStores = storagesStore.all.value;
  if (!ships || !allStores) {
    return [];
  }

  const result: ShipBarData[] = [];
  for (const ship of ships) {
    let isRelevant = false;
    if (ship.flightId) {
      const flight = flightsStore.getById(ship.flightId);
      if (flight && getEntityNaturalIdFromAddress(flight.destination) === props.naturalId) {
        isRelevant = true;
      }
    } else if (ship.address && getEntityNaturalIdFromAddress(ship.address) === props.naturalId) {
      isRelevant = true;
    }
    if (!isRelevant) {
      continue;
    }

    const store = allStores.find(x => x.id === ship.idShipStore);
    if (!store) {
      continue;
    }

    const wCap = store.weightCapacity;
    const vCap = store.volumeCapacity;
    const wLoad = store.weightLoad;
    const vLoad = store.volumeLoad;

    const weightRatio = wCap > 0 ? wLoad / wCap : 0;
    const volumeRatio = vCap > 0 ? vLoad / vCap : 0;
    const maxRatio = Math.max(weightRatio, volumeRatio);
    const useVolume = volumeRatio > weightRatio;

    const isMiniMode = maxRatio <= 0.05 && maxRatio > 0;
    const activeLoad = useVolume ? vLoad : wLoad;
    const activeCapacity = useVolume ? vCap : wCap;
    let divisor = isMiniMode ? activeLoad : activeCapacity;
    if (divisor === 0) {
      divisor = 1;
    }

    const formatTitle = (name: string, weight: number, volume: number) => {
      const load = useVolume ? fixed02(volume) + 'm³' : fixed02(weight) + 't';
      return `${name}: ${load}`;
    };

    const segments: Segment[] = [];
    const summary = getInventorySummary(store);

    const categories = [...summary.categories.keys()].sort((a, b) => a.name.localeCompare(b.name));
    for (const category of categories) {
      const categorySummary = summary.categories.get(category)!;
      const value = useVolume ? categorySummary.volume : categorySummary.weight;
      segments.push({
        name: category.name,
        class: getMaterialCategoryCssClass(category),
        width: `${(value * 100) / divisor}%`,
        title: formatTitle(category.name, categorySummary.weight, categorySummary.volume),
      });
    }

    if (summary.shipments.weight > 0 || summary.shipments.volume > 0) {
      const value = useVolume ? summary.shipments.volume : summary.shipments.weight;
      segments.push({
        name: 'shipments',
        class: 'rp-category-none',
        width: `${(value * 100) / divisor}%`,
        title: formatTitle('shipments', summary.shipments.weight, summary.shipments.volume),
      });
    }

    if (!isMiniMode) {
      enhanceSegmentVisibility(segments, maxRatio);
    }

    result.push({
      id: ship.id,
      displayName: ship.name.substring(0, 10),
      storeCmd: `INV ${store.id.substring(0, 8)}`,
      segments,
      miniMode: isMiniMode,
      stripeColor: computeStripeColor(maxRatio),
      stripeWidth: computeStripeWidth(maxRatio),
    });
  }
  return result;
});

function enhanceSegmentVisibility(segments: Segment[], loadRatio: number) {
  const lowContrastCategories = new Set(['elements', 'metals', 'shipments', 'unit prefabs']);
  const isAlmostFull = loadRatio > 0.98;

  if (segments.length === 1 && isAlmostFull) {
    return;
  }

  for (let i = 1; i < segments.length; i++) {
    const current = segments[i];
    const previous = segments[i - 1];
    if (lowContrastCategories.has(current.name) && lowContrastCategories.has(previous.name)) {
      current.borderClasses = [$style.borderLeft];
    }
  }

  if (!isAlmostFull) {
    const last = segments[segments.length - 1];
    last.borderClasses ??= [];
    last.borderClasses.push($style.borderRight);
  }
}

interface CategorySummary {
  weight: number;
  volume: number;
}

function getInventorySummary(store: PrunApi.Store) {
  const shipments: CategorySummary = { weight: 0, volume: 0 };
  const categories = new Map<PrunApi.MaterialCategory, CategorySummary>();

  for (const item of store.items) {
    if (item.type === 'SHIPMENT') {
      shipments.weight += item.weight;
      shipments.volume += item.volume;
      continue;
    }

    const material = item.quantity?.material;
    if (!material) {
      continue;
    }

    const category = materialCategoriesStore.getById(material.category);
    if (!category) {
      continue;
    }

    let categorySummary = categories.get(category);
    if (!categorySummary) {
      categorySummary = { weight: 0, volume: 0 };
      categories.set(category, categorySummary);
    }

    categorySummary.weight += item.weight;
    categorySummary.volume += item.volume;
  }

  return { shipments, categories };
}

function computeStripeColor(ratio: number) {
  const start = { r: 50, g: 50, b: 50 };
  const target = { r: 100, g: 100, b: 100 };
  if (ratio < 0.7) {
    return `rgb(${start.r}, ${start.g}, ${start.b})`;
  }
  const normalized = (ratio - 0.7) / 0.3;
  const r = Math.round(start.r + (target.r - start.r) * normalized);
  const g = Math.round(start.g + (target.g - start.g) * normalized);
  const b = Math.round(start.b + (target.b - start.b) * normalized);
  return `rgb(${r}, ${g}, ${b})`;
}

function computeStripeWidth(ratio: number) {
  const startWidth = 10;
  const smallWidth = 2;
  if (ratio < 0.7) {
    return `${startWidth}px`;
  }
  const normalized = (ratio - 0.7) / 0.3;
  return `${startWidth - (startWidth - smallWidth) * normalized}px`;
}

const isAnimating = ref(false);
let animationTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => shipBars.value,
  () => {
    if (animationTimeout) {
      clearTimeout(animationTimeout);
    }
    isAnimating.value = true;
    animationTimeout = setTimeout(() => {
      isAnimating.value = false;
    }, 1000);
  },
  { deep: true },
);
</script>

<template>
  <div v-if="shipBars.length > 0" :class="$style.container">
    <div
      v-for="bar in shipBars"
      :key="bar.id"
      :class="$style.barWrapper"
      :data-tooltip="bar.displayName"
      data-tooltip-position="top"
      @click="showBuffer(bar.storeCmd)">
      <div
        :class="[C.ProgressBar.progress, $style.bar, { [$style.isUpdating]: isAnimating }]"
        :style="{ '--stripe-color': bar.stripeColor, '--stripe-width': bar.stripeWidth }">
        <div :class="[$style.innerBar, { [$style.miniBar]: bar.miniMode }]">
          <div
            v-for="segment in bar.segments"
            :key="segment.name"
            :class="[segment.class, segment.borderClasses]"
            :style="{ width: segment.width }"
            :title="segment.title" />
        </div>
      </div>
    </div>
  </div>
</template>

<style module>
.container {
  display: flex;
  flex-direction: row;
  gap: 2px;
}

.barWrapper {
  width: 30px;
  flex-shrink: 0;
  cursor: pointer;

  &::before {
    text-align: right;
  }
}

.bar {
  width: 100%;
  min-height: 13px;
  height: 13px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  background-color: #2a2a2a;
  --stripe-width: 10px;
  --hypotenuse: calc(var(--stripe-width) * sqrt(2));

  background-image: repeating-linear-gradient(
    45deg,
    #2a2a2a,
    #2a2a2a calc(var(--stripe-width) / 2),
    var(--stripe-color) calc(var(--stripe-width) / 2),
    var(--stripe-color) var(--stripe-width)
  );
  background-size: var(--hypotenuse) var(--hypotenuse);
}

.isUpdating {
  animation: move-stripes 0.5s linear infinite;
}

@keyframes move-stripes {
  from {
    background-position: 0 0;
  }
  to {
    background-position: var(--hypotenuse) 0;
  }
}

.innerBar {
  width: 100%;
  height: 100%;
  display: flex;
}

.miniBar {
  width: 25%;
  height: 50%;
  border-top: 1px solid #999;
  border-right: 1px solid #999;
}

.borderLeft {
  border-left: 1px solid #999;
}

.borderRight {
  border-right: 1px solid #999;
}
</style>
