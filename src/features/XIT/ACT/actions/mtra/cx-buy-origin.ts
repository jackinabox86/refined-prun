import { serializeStorage } from '@src/features/XIT/ACT/actions/utils';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';

// When CX buy has an exchange, MTRA "from" should be that CX warehouse.
// Returns undefined when there is no exchange (never invent a from).
export function linkedMtraOrigin(
  originIsConfigurable: boolean,
  cxBuyExchange: string | undefined,
  resolveOrigin: (exchange: string) => string | undefined,
): string | undefined {
  if (!originIsConfigurable || cxBuyExchange === undefined || cxBuyExchange === '') {
    return undefined;
  }
  return resolveOrigin(cxBuyExchange);
}

export function serializedWarehouseForExchange(exchange: string | undefined): string | undefined {
  if (exchange === undefined || exchange === '') {
    return undefined;
  }
  const cx = exchangesStore.getByCode(exchange);
  if (cx === undefined) {
    return undefined;
  }
  const warehouse =
    warehousesStore.getByEntityNaturalIdOrName(getEntityNaturalIdFromAddress(cx.address)) ??
    warehousesStore.getByEntityNaturalIdOrName(getEntityNameFromAddress(cx.address));
  if (warehouse === undefined) {
    return undefined;
  }
  const store = storagesStore
    .getByAddressableId(warehouse.warehouseId)
    ?.find(x => x.type === 'WAREHOUSE_STORE');
  if (store === undefined) {
    return undefined;
  }
  return serializeStorage(store);
}
