import {
  getLocationLineFromAddress,
  isPlanetLine,
} from '@src/infrastructure/prun-api/data/addresses';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { selectMaterial } from '@src/features/XIT/ACT/action-steps/cont-utils';
import { changeInputValue, clickElement } from '@src/util';
import { sleep } from '@src/utils/sleep';
import {
  CargoAmount,
  cargoFitsStore,
  getClampedTransferAmount,
  getCargoSnapshot,
  getUnloadedCargo,
  isUnloadTransferEligible,
  storeContainsCargo,
} from './unload-plan';

const actionTimeoutMs = 15_000;
const inProgressShipIds = new Set<string>();

function onFleetTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.Fleet.buttons), buttons => {
    const fleetRow = buttons.closest('tr');
    if (fleetRow === null) {
      return;
    }
    buttons.addEventListener(
      'click',
      e => {
        const target = e.target;
        if (!(target instanceof Element)) {
          return;
        }
        const button = target.closest('button');
        if (
          button === null ||
          !buttons.contains(button) ||
          button.textContent?.trim().toLowerCase() !== 'unload'
        ) {
          return;
        }
        const ship = findFleetRowShip(fleetRow);
        if (ship !== undefined) {
          planWarehouseUnload(ship, e.shiftKey);
        }
      },
      true,
    );
  });
}

function onShipInventoryTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.Button.primary), button => {
    button.addEventListener(
      'click',
      e => {
        if (button.textContent?.trim().toLowerCase() !== 'unload') {
          return;
        }
        const ship = shipsStore.getByRegistration(tile.parameter);
        if (ship !== undefined) {
          planWarehouseUnload(ship, e.shiftKey);
        }
      },
      true,
    );
  });
}

function findFleetRowShip(fleetRow: Element) {
  const identifiers = new Set(_$$(fleetRow, C.Link.link).map(x => x.textContent?.trim()));
  return shipsStore.all.value?.find(
    x => identifiers.has(x.registration) || identifiers.has(x.name),
  );
}

function planWarehouseUnload(ship: PrunApi.Ship, shiftKey: boolean) {
  const location = getLocationLineFromAddress(ship.address ?? undefined);
  const landedAtPlanet = ship.flightId === null && isPlanetLine(location);
  const planetNaturalId = landedAtPlanet ? location.entity.naturalId : undefined;
  const site = sitesStore.getByPlanetNaturalId(planetNaturalId);
  const baseStore = storagesStore.all.value?.find(
    x => x.addressableId === site?.siteId && x.type === 'STORE',
  );
  const warehouse = warehousesStore.getByEntityNaturalId(planetNaturalId);
  const warehouseStore = storagesStore.getById(warehouse?.storeId);
  const shipStore = storagesStore.getById(ship.idShipStore);
  const before = getCargoSnapshot(shipStore);

  if (
    !isUnloadTransferEligible({
      shiftKey,
      landedAtPlanet,
      hasBaseStore: baseStore !== undefined,
      hasWarehouseStore: warehouseStore !== undefined && !warehouseStore.locked,
      hasCargo: before.length > 0,
      inProgress: inProgressShipIds.has(ship.id),
    })
  ) {
    return;
  }

  inProgressShipIds.add(ship.id);
  void runWarehouseUnload(ship.id, ship.idShipStore, baseStore!.id, warehouseStore!.id, before);
}

async function runWarehouseUnload(
  shipId: string,
  shipStoreId: string,
  baseStoreId: string,
  warehouseStoreId: string,
  before: CargoAmount[],
) {
  try {
    await finishWarehouseUnload(shipId, shipStoreId, baseStoreId, warehouseStoreId, before);
  } catch (e) {
    console.error('Shift-click warehouse unload failed.', e);
  } finally {
    inProgressShipIds.delete(shipId);
  }
}

async function finishWarehouseUnload(
  shipId: string,
  shipStoreId: string,
  baseStoreId: string,
  warehouseStoreId: string,
  before: CargoAmount[],
) {
  const unloaded = await waitForUnloadedCargo(shipStoreId, before);
  if (unloaded.length === 0 || !inProgressShipIds.has(shipId)) {
    return;
  }

  const baseStore = storagesStore.getById(baseStoreId);
  const warehouseStore = storagesStore.getById(warehouseStoreId);
  if (
    warehouseStore === undefined ||
    warehouseStore.locked ||
    !storeContainsCargo(baseStore, unloaded) ||
    !cargoFitsStore(warehouseStore, unloaded)
  ) {
    return;
  }

  for (const cargo of unloaded) {
    if (!(await transferMaterial(baseStoreId, warehouseStoreId, cargo))) {
      return;
    }
  }
}

async function waitForUnloadedCargo(shipStoreId: string, before: CargoAmount[]) {
  return await new Promise<CargoAmount[]>(resolve => {
    const stop = watch(
      () => getCargoSnapshot(storagesStore.getById(shipStoreId)),
      after => {
        const unloaded = getUnloadedCargo(before, after);
        if (unloaded.length > 0) {
          window.clearTimeout(timeout);
          stop();
          resolve(unloaded);
        }
      },
      { deep: true },
    );
    const timeout = window.setTimeout(() => {
      stop();
      resolve([]);
    }, actionTimeoutMs);
  });
}

async function transferMaterial(fromId: string, toId: string, cargo: CargoAmount) {
  const from = storagesStore.getById(fromId);
  const to = storagesStore.getById(toId);
  if (!storeContainsCargo(from, [cargo]) || to === undefined || !cargoFitsStore(to, [cargo])) {
    return false;
  }

  const closed = ref(false);
  const windowEl = await showBuffer(
    `MTRA from-${fromId.substring(0, 8)} to-${toId.substring(0, 8)}`,
    { force: true, autoClose: true, closeWhen: computed(() => closed.value) },
  );
  if (windowEl === undefined) {
    return false;
  }

  try {
    const selector = await waitForValue(() => _$(windowEl, C.MaterialSelector.container), windowEl);
    if (selector === undefined || !(await selectMaterial(selector, cargo.ticker))) {
      return false;
    }

    const sliderNumbers = _$$(windowEl, 'rc-slider-mark-text').map(x => Number(x.textContent ?? 0));
    const transferAmount = getClampedTransferAmount(cargo.amount, Math.max(...sliderNumbers));
    if (transferAmount !== cargo.amount) {
      return false;
    }

    const amountInput = _$$(windowEl, 'input')[1];
    if (amountInput === undefined) {
      return false;
    }
    changeInputValue(amountInput, transferAmount.toString());

    const transfer = await waitForValue(() => _$(windowEl, C.Button.btn), windowEl);
    if (!(transfer instanceof HTMLElement)) {
      return false;
    }

    const beforeAmount = getStoreAmount(toId, cargo.ticker);
    await clickElement(transfer);
    const outcome = await waitForValue(
      () => _$(windowEl, C.ActionFeedback.success) ?? _$(windowEl, C.ActionFeedback.error),
      windowEl,
    );
    if (outcome === undefined || outcome.classList.contains(C.ActionFeedback.error)) {
      return false;
    }
    return await waitForStoreIncrease(toId, cargo.ticker, beforeAmount);
  } finally {
    closed.value = true;
    await waitForWindowClose(windowEl);
  }
}

async function waitForStoreIncrease(storeId: string, ticker: string, before: number) {
  if (getStoreAmount(storeId, ticker) > before) {
    return true;
  }
  return await new Promise<boolean>(resolve => {
    const stop = watch(
      () => getStoreAmount(storeId, ticker),
      amount => {
        if (amount > before) {
          window.clearTimeout(timeout);
          stop();
          resolve(true);
        }
      },
    );
    const timeout = window.setTimeout(() => {
      stop();
      resolve(false);
    }, actionTimeoutMs);
  });
}

function getStoreAmount(storeId: string, ticker: string) {
  return (
    storagesStore.getById(storeId)?.items.find(x => x.quantity?.material.ticker === ticker)
      ?.quantity?.amount ?? 0
  );
}

async function waitForValue<T>(getValue: () => T | undefined, node: Node) {
  const deadline = Date.now() + actionTimeoutMs;
  while (node.isConnected && Date.now() < deadline) {
    const value = getValue();
    if (value !== undefined) {
      return value;
    }
    await sleep(50);
  }
  return undefined;
}

async function waitForWindowClose(windowEl: Element) {
  const deadline = Date.now() + actionTimeoutMs;
  while (windowEl.isConnected && Date.now() < deadline) {
    await sleep(50);
  }
}

function init() {
  tiles.observe('FLT', onFleetTileReady);
  tiles.observe('SHPI', onShipInventoryTileReady);
}

features.add(
  import.meta.url,
  init,
  'FLT/SHPI: Shift-click Unload to move landed ship cargo into the local warehouse.',
);
