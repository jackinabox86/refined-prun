import { cxRouteReserve } from '@src/features/XIT/ROUTE/cx-route-reserve';
import { routeStockDraws, type RouteStockDraw } from '@src/features/XIT/ROUTE/route-reserve';
import RouteStockWarning from '@src/features/XIT/ROUTE/RouteStockWarning.vue';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { showTileOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { fixed0 } from '@src/utils/format';

// The dismissable guard on anything that moves stock out of a CX warehouse
// (ACT's MTRA step, a contract FULFILL click). It never blocks: the player
// dismisses it and carries on as they choose.

function exchangeOfStore(store: PrunApi.Store) {
  if (store.type !== 'WAREHOUSE_STORE') {
    return undefined;
  }
  const warehouse = warehousesStore.getById(store.addressableId);
  return exchangesStore.getByNaturalId(getEntityNaturalIdFromAddress(warehouse?.address))?.code;
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

// What taking `take` out of `store` would leave below the route reserve there.
// Undefined when the store is not a CX warehouse or nothing would drop below it.
export function routeStockShortfall(
  store: PrunApi.Store | undefined,
  take: Readonly<Record<string, number>>,
) {
  if (store === undefined) {
    return undefined;
  }
  const exchange = exchangeOfStore(store);
  if (exchange === undefined) {
    return undefined;
  }
  const reserve = cxRouteReserve(Date.now())[exchange];
  if (reserve === undefined) {
    return undefined;
  }
  const stock: Record<string, number> = {};
  for (const item of store.items) {
    if (item.quantity) {
      stock[item.quantity.material.ticker] = item.quantity.amount;
    }
  }
  const draws = routeStockDraws(stock, take, reserve);
  return draws.length > 0 ? { exchange, draws } : undefined;
}

export function describeRouteStockDraw(exchange: string, draw: RouteStockDraw) {
  return (
    `This leaves ${fixed0(draw.left)} ${draw.ticker} on ${exchange}, ` +
    `below the ${fixed0(draw.held)} held for routes`
  );
}

// Shows the warning over ACT when taking `take` out of `store` would leave less
// than the routes hold there, and resolves once the player dismisses it.
export async function guardRouteStock(
  anchor: Element,
  store: PrunApi.Store | undefined,
  take: Readonly<Record<string, number>>,
  log: { warning: (message: string) => void },
) {
  const shortfall = routeStockShortfall(store, take);
  if (shortfall === undefined) {
    return;
  }
  const { exchange, draws } = shortfall;
  for (const draw of draws) {
    log.warning(describeRouteStockDraw(exchange, draw));
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
