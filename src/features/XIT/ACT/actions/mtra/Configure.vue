<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import Passive from '@src/components/forms/Passive.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import {
  autoSfcPlanetRaw,
  initialPlanetAutoSfc,
  rememberPlanetAutoSfc,
  shouldShowAutoSfcToggle,
} from '@src/features/XIT/ACT/actions/mtra/auto-sfc';
import { Config, CX_BUY_ONLY_DEST } from '@src/features/XIT/ACT/actions/mtra/config';
import {
  linkedMtraOrigin,
  serializedWarehouseForExchange,
} from '@src/features/XIT/ACT/actions/mtra/cx-buy-origin';
import {
  atSameLocation,
  deserializeStorage,
  isCXWarehouse,
  serializeStorage,
  storageSort,
} from '@src/features/XIT/ACT/actions/utils';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';
import { useXitCommand } from '@src/hooks/use-xit-command';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { userData } from '@src/store/user-data';

const { data, config, cxBuyExchange } = defineProps<{
  data: UserData.ActionData;
  config: Config;
  cxBuyExchange?: string;
}>();

const allStorages = computed(() => storagesStore.nonFuelStores.value ?? []);

const originStorages = computed(() => {
  let storages = [...allStorages.value];
  if (data.dest !== configurableValue) {
    const destination = deserializeStorage(data.dest);
    if (destination) {
      storages = storages.filter(x => atSameLocation(x, destination) && x !== destination);
    }
  }
  return storages.sort(storageSort);
});

const originOptions = computed(() => {
  return getOptions(originStorages.value);
});

if (data.origin === configurableValue && !config.origin && originStorages.value.length > 0) {
  config.origin = serializeStorage(originStorages.value[0]);
}

function applyLinkedOrigin(exchange: string | undefined) {
  if (data.origin !== configurableValue) {
    return false;
  }
  const linked = linkedMtraOrigin(true, exchange, serializedWarehouseForExchange);
  const linkedStore = deserializeStorage(linked);
  if (
    linked !== undefined &&
    linkedStore !== undefined &&
    originStorages.value.includes(linkedStore)
  ) {
    config.origin = linked;
    return true;
  }
  return false;
}

const destinationStorages = computed(() => {
  let storages = [...allStorages.value];
  const originRef = data.origin !== configurableValue ? data.origin : config.origin;
  const origin = deserializeStorage(originRef);
  if (origin) {
    storages = storages.filter(x => atSameLocation(x, origin) && x !== origin);
  }
  return storages.sort(storageSort);
});

const originIsCXWarehouse = computed(() => {
  const originRef = data.origin !== configurableValue ? data.origin : config.origin;
  const origin = deserializeStorage(originRef);
  return origin ? isCXWarehouse(origin) : false;
});

const destinationOptions = computed(() => {
  const options = getOptions(destinationStorages.value);
  if (originIsCXWarehouse.value) {
    options.push({ label: CX_BUY_ONLY_DEST, value: CX_BUY_ONLY_DEST });
  }
  return options;
});

if (
  data.dest === configurableValue &&
  !config.destination &&
  destinationStorages.value.length > 0
) {
  config.destination = serializeStorage(destinationStorages.value[0]);
}

// When CX buy's exchange is set or changes, point MTRA from at that warehouse.
// Do not keep rewriting from after the player picks a different origin.
watch(
  () => cxBuyExchange,
  exchange => {
    applyLinkedOrigin(exchange);
  },
  { immediate: true },
);

// Autofill and autofix selections on storage list change.
watchEffect(() => {
  if (data.origin === configurableValue) {
    if (config.origin) {
      const origin = deserializeStorage(config.origin);
      if (!origin || !originStorages.value.includes(origin)) {
        config.origin = undefined;
      }
    }

    if (!config.origin && !applyLinkedOrigin(cxBuyExchange) && originStorages.value.length === 1) {
      config.origin = serializeStorage(originStorages.value[0]);
    }
  }

  if (data.dest === configurableValue) {
    if (config.destination && config.destination !== CX_BUY_ONLY_DEST) {
      const destination = deserializeStorage(config.destination);
      if (!destination || !destinationStorages.value.includes(destination)) {
        config.destination = undefined;
      }
    }

    if (!config.destination && destinationStorages.value.length === 1) {
      config.destination = serializeStorage(destinationStorages.value[0]);
    }
  }
});

function getOptions(storages: PrunApi.Store[]) {
  const options = storages.map(serializeStorage).map(x => ({ label: x, value: x }));
  if (options.length === 0) {
    options.push({ label: 'No locations available', value: undefined! });
  }
  return options;
}

const command = useXitCommand();
const parameters = useXitParameters();

const planetId = computed(() => {
  const raw = autoSfcPlanetRaw(command, data.sfcDestination, parameters.join(' '));
  if (raw === undefined) {
    return undefined;
  }
  const site = sitesStore.getByPlanetNaturalIdOrName(raw);
  return getEntityNaturalIdFromAddress(site?.address) ?? raw;
});

const showAutoSfcToggle = computed(
  () => shouldShowAutoSfcToggle(command) && planetId.value !== undefined,
);

watch(
  planetId,
  id => {
    if (id === undefined || !shouldShowAutoSfcToggle(command)) {
      return;
    }
    config.autoSfc ??= initialPlanetAutoSfc(userData.settings.planetAutoSfc, id);
  },
  { immediate: true },
);

const autoSfc = computed({
  get() {
    return config.autoSfc ?? true;
  },
  set(value: boolean) {
    config.autoSfc = value;
    const id = planetId.value;
    if (id === undefined) {
      return;
    }
    const map = (userData.settings.planetAutoSfc ??= {});
    rememberPlanetAutoSfc(map, id, value);
  },
});
</script>

<template>
  <form>
    <Active v-if="data.origin === configurableValue" label="From">
      <SelectInput v-model="config.origin" :options="originOptions" />
    </Active>
    <Passive v-else label="From">
      <span>{{ data.origin }}</span>
    </Passive>
    <Active v-if="data.dest === configurableValue" label="To">
      <SelectInput v-model="config.destination" :options="destinationOptions" />
    </Active>
    <Passive v-else label="To">
      <span>{{ data.dest }}</span>
    </Passive>
    <Active v-if="showAutoSfcToggle" label="Auto SFC">
      <RadioItem v-model="autoSfc">auto sfc</RadioItem>
    </Active>
  </form>
</template>
