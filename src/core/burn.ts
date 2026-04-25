import { productionStore } from '@src/infrastructure/prun-api/data/production';
import { workforcesStore } from '@src/infrastructure/prun-api/data/workforces';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { getRecurringOrders } from '@src/core/orders';
import { userData } from '@src/store/user-data';

export interface MaterialBurn {
  input: number;
  output: number;
  workforce: number;
  dailyAmount: number;
  inventory: number;
  daysLeft: number;
  type: 'input' | 'output' | 'workforce';
}

export interface BurnValues {
  [ticker: string]: MaterialBurn;
}

export interface PlanetBurn {
  storeId: string;
  planetName: string;
  naturalId: string;
  burn: BurnValues;
}

const burnBySiteId = computed(() => {
  if (!sitesStore.all.value) {
    return undefined;
  }

  const bySiteId = new Map<string, Ref<PlanetBurn | undefined>>();
  for (const site of sitesStore.all.value) {
    bySiteId.set(
      site.siteId,
      computed(() => {
        const id = site.siteId;
        const workforce = workforcesStore.getById(id)?.workforces;
        const production = productionStore.getBySiteId(id);
        const storage = storagesStore.getByAddressableId(id);
        if (!workforce || !production) {
          return undefined;
        }

        const naturalId = getEntityNaturalIdFromAddress(site.address);
        const inboundStores = getInboundShipStores(naturalId);
        const combinedStorage = [...(storage ?? []), ...inboundStores];

        return {
          storeId: storage?.[0]?.id,
          planetName: getEntityNameFromAddress(site.address),
          naturalId,
          burn: calculatePlanetBurn(production, workforce, combinedStorage),
        } as PlanetBurn;
      }),
    );
  }
  return bySiteId;
});

function getInboundShipStores(planetNaturalId: string | undefined) {
  if (!inboundShipInventoryEnabled.value) {
    return [];
  }
  if (!planetNaturalId) {
    return [];
  }
  const ships = shipsStore.all.value;
  const stores = storagesStore.all.value;
  if (!ships || !stores) {
    return [];
  }
  const result: PrunApi.Store[] = [];
  for (const ship of ships) {
    if (!ship.flightId) {
      continue;
    }
    const flight = flightsStore.getById(ship.flightId);
    if (!flight) {
      continue;
    }
    if (getEntityNaturalIdFromAddress(flight.destination) !== planetNaturalId) {
      continue;
    }
    const shipStore = stores.find(x => x.id === ship.idShipStore);
    if (shipStore) {
      result.push(shipStore);
    }
  }
  return result;
}

const inboundShipInventoryEnabled = ref(false);

export function setInboundShipInventoryEnabled(value: boolean) {
  inboundShipInventoryEnabled.value = value;
}

export function getPlanetBurn(siteOrId?: PrunApi.Site | string | null) {
  const site = typeof siteOrId === 'string' ? sitesStore.getById(siteOrId) : siteOrId;
  if (!site) {
    return undefined;
  }

  return burnBySiteId.value?.get(site.siteId)?.value;
}

export function calculatePlanetBurn(
  production: PrunApi.ProductionLine[] | undefined,
  workforces: PrunApi.Workforce[] | undefined,
  storage: PrunApi.Store[] | undefined,
) {
  const burnValues: BurnValues = {};

  function getBurnValue(ticker: string) {
    burnValues[ticker] ??= {
      input: 0,
      output: 0,
      workforce: 0,
      dailyAmount: 0,
      inventory: 0,
      daysLeft: 0,
      type: 'output',
    };
    return burnValues[ticker];
  }

  if (production) {
    for (const line of production) {
      const capacity = line.capacity;
      const burnOrders = getRecurringOrders(line);
      let totalDuration = sumBy(burnOrders, x => x.duration?.millis ?? Infinity);
      // Convert to days
      totalDuration /= 86400000;

      for (const order of burnOrders) {
        for (const mat of order.outputs) {
          const materialBurn = getBurnValue(mat.material.ticker);
          materialBurn.output += (mat.amount * capacity) / totalDuration;
        }
        for (const mat of order.inputs) {
          const materialBurn = getBurnValue(mat.material.ticker);
          materialBurn.input += (mat.amount * capacity) / totalDuration;
        }
      }
    }
  }

  if (workforces) {
    for (const tier of workforces) {
      if (tier.population <= 1) {
        // Don't count the bugged workforce with one population.
        continue;
      }
      if (tier.capacity === 0) {
        // After demolishing housing, you can get homeless pops that don't consume goods.
        continue;
      }
      for (const need of tier.needs) {
        const materialBurn = getBurnValue(need.material.ticker);
        materialBurn.workforce += need.unitsPerInterval;
      }
    }
  }

  for (const ticker of Object.keys(burnValues)) {
    const burnValue = burnValues[ticker];
    burnValue.dailyAmount = burnValue.output;
    burnValue.type = 'output';
    burnValue.dailyAmount -= burnValue.workforce;
    if (burnValue.workforce > 0 && burnValue.dailyAmount <= 0) {
      burnValue.type = 'workforce';
    }
    burnValue.dailyAmount -= burnValue.input;
    if (burnValue.input > 0 && burnValue.dailyAmount <= 0) {
      burnValue.type = 'input';
    }
  }

  if (storage) {
    for (const inventory of storage) {
      for (const item of inventory.items) {
        const quantity = item.quantity;
        if (!quantity) {
          continue;
        }
        const materialBurn = burnValues[quantity.material.ticker];
        if (materialBurn === undefined) {
          continue;
        }
        materialBurn.inventory += quantity.amount;
        if (quantity.amount != 0) {
          materialBurn.daysLeft =
            materialBurn.dailyAmount > 0
              ? 1000
              : Math.floor(-materialBurn.inventory / materialBurn.dailyAmount);
        }
      }
    }
  }

  return burnValues;
}

export function getResupplyDays(planetNaturalId?: string | null) {
  if (planetNaturalId) {
    const override = userData.settings.burn.planetResupply?.[planetNaturalId];
    if (override !== undefined) {
      return override;
    }
  }
  return userData.settings.burn.resupply;
}

export function computeNeed(mat: MaterialBurn, resupplyDays: number) {
  const production = mat.dailyAmount;
  const isInf = production >= 0;
  const days = isInf ? 1000 : mat.daysLeft;
  if (days > resupplyDays || production > 0) {
    return 0;
  }
  const need = Math.ceil((days - resupplyDays) * production);
  // This check is needed to prevent a "-0" value that can happen
  // in situations like: 0 * -0.25 => -0.
  return need === 0 ? 0 : need;
}
