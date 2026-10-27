import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import {
  cxWarehouseStoreAt,
  describeRouteStockDraw,
  routeStockShortfall,
} from '@src/features/XIT/ROUTE/route-stock-guard';
import { showConfirmationOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { clickElement } from '@src/util';

// Conditions whose FULFILL hands the player's own materials over to the partner.
const HANDOVER_TYPES: PrunApi.ContractConditionType[] = [
  'DELIVERY',
  'PROVISION',
  'PROVISION_SHIPMENT',
];

function onTileReady(tile: PrunTile) {
  // A FULFILL the player confirmed through the warning goes straight through.
  const confirmed = new WeakSet<Element>();

  tile.anchor.addEventListener(
    'click',
    e => {
      const button = (e.target as Element | null)?.closest?.(`.${C.Button.btn}`);
      if (!button || button.textContent?.trim().toUpperCase() !== 'FULFILL') {
        return;
      }
      if (confirmed.has(button)) {
        confirmed.delete(button);
        return;
      }
      const condition = findCondition(tile, button);
      if (!condition?.quantity) {
        return;
      }
      const shortfall = routeStockShortfall(sourceStore(condition), {
        [condition.quantity.material.ticker]: condition.quantity.amount,
      });
      if (!shortfall) {
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      const message = shortfall.draws
        .map(x => describeRouteStockDraw(shortfall.exchange, x))
        .join('. ');
      showConfirmationOverlay(
        tile.anchor,
        () => {
          confirmed.add(button);
          void clickElement(button as HTMLElement);
        },
        { message: `${message}.`, confirmLabel: 'Fulfill anyway' },
      );
    },
    true,
  );
}

// The CONT table lists the contract's conditions in order, one row each.
function findCondition(tile: PrunTile, button: Element) {
  const contract =
    contractsStore.getByLocalId(tile.parameter?.toUpperCase()) ??
    contractsStore.getById(tile.parameter);
  const row = button.closest('tr');
  if (!contract || !row?.parentElement) {
    return undefined;
  }
  const rows = Array.from(row.parentElement.children).filter(x => x.tagName === 'TR');
  const conditions = [...contract.conditions].sort((a, b) => a.index - b.index);
  if (rows.length !== conditions.length) {
    return undefined;
  }
  const condition = conditions[rows.indexOf(row)];
  if (condition?.party !== contract.party || !HANDOVER_TYPES.includes(condition.type)) {
    return undefined;
  }
  return condition;
}

// Where the handed-over goods come from: the auto-provision store a shipment
// names, otherwise the player's CX warehouse at the condition's location.
function sourceStore(condition: PrunApi.ContractCondition) {
  const storeId = condition.autoProvisionStoreId;
  if (storeId) {
    return storagesStore.getById(storeId) ?? storagesStore.getById(storeId.replaceAll('-', ''));
  }
  return cxWarehouseStoreAt(getEntityNaturalIdFromAddress(condition.address));
}

function init() {
  tiles.observe('CONT', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONT: Warns before a FULFILL that would draw a CX warehouse below its route stock.',
);
