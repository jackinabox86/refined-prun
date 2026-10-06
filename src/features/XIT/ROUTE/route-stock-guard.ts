import { cxRouteReserve } from '@src/features/XIT/ROUTE/cx-route-reserve';
import { floorReserve, routeStockDraws } from '@src/features/XIT/ROUTE/route-reserve';
import RouteStockWarning from '@src/features/XIT/ROUTE/RouteStockWarning.vue';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { showTileOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { fixed0 } from '@src/utils/format';

// The dismissable guard on steps that move stock out of a CX warehouse without
// buying it first (MTRA, contract drafts). It never blocks: DISMISS, then ACT
// or SKIP as usual.

function exchangeOfStore(store: PrunApi.Store) {
  if (store.type !== 'WAREHOUSE_STORE') {
    return undefined;
  }
  const warehouse = warehousesStore.getById(store.addressableId);
  return exchangesStore.getByNaturalId(getEntityNaturalIdFromAddress(warehouse?.address))?.code;
}

// What the reserve held out of each CX warehouse when the running package was
// generated. A package's own CX Buy lands on top of that, so the guard floors at
// it: moving goods the package just bought never warns, even when the warehouse
// was already under the route reserve.
let runHeld: Record<string, Record<string, number>> | undefined;

export function setRunHeld(held: Record<string, Record<string, number>> | undefined) {
  runHeld = held;
}

// The CX warehouse store at a location, by natural id or name. Undefined off an exchange.
export function cxWarehouseStoreAt(location: string | undefined) {
  const warehouse = warehousesStore.getByEntityNaturalIdOrName(location);
  if (warehouse === undefined) {
    return undefined;
  }
  return storagesStore
    .getByAddressableId(warehouse.warehouseId)
    ?.find(x => x.type === 'WAREHOUSE_STORE');
}

// Shows the warning over ACT when taking `take` out of `store` would leave less
// than the routes hold there, and resolves once the player dismisses it.
export async function guardRouteStock(
  anchor: Element,
  store: PrunApi.Store | undefined,
  take: Readonly<Record<string, number>>,
  log: { warning: (message: string) => void },
) {
  if (store === undefined) {
    return;
  }
  const exchange = exchangeOfStore(store);
  if (exchange === undefined) {
    return;
  }
  const live = cxRouteReserve(Date.now())[exchange];
  if (live === undefined) {
    return;
  }
  const reserve = floorReserve(live, runHeld?.[exchange]);
  const stock: Record<string, number> = {};
  for (const item of store.items) {
    if (item.quantity) {
      stock[item.quantity.material.ticker] = item.quantity.amount;
    }
  }
  const draws = routeStockDraws(stock, take, reserve);
  if (draws.length === 0) {
    return;
  }
  for (const draw of draws) {
    log.warning(
      `This leaves ${fixed0(draw.left)} ${draw.ticker} on ${exchange}, ` +
        `below the ${fixed0(draw.held)} held for routes`,
    );
  }
  await new Promise<void>(resolve => {
    showTileOverlay(
      anchor,
      RouteStockWarning,
      { exchange, draws },
      // Same as the price warning: the overlay covers ACT, so only DISMISS closes it.
      { onClosed: resolve, dismissOnBackdrop: false },
    );
  });
}
