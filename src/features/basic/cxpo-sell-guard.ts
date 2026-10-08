import {
  cxWarehouseStoreAt,
  describeRouteStockDraw,
  routeStockShortfall,
} from '@src/features/XIT/ROUTE/route-stock-guard';
import { cxRouteReserve } from '@src/features/XIT/ROUTE/cx-route-reserve';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { L } from '@src/infrastructure/prun-ui/i18n';
import { showConfirmationOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { onNodeDisconnectedLazy } from '@src/utils/on-node-disconnected';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';
import { clickElement } from '@src/util';
import { cxpoInventoryLabel, isCxpoInventoryLabel } from '@src/features/basic/cxpo-route-stock';

// CXPO has no class for the sell button or the inventory row. The sell button
// is a C.Button.btn whose text is SELL (the buy button is the sibling whose
// text is BUY). The inventory row is the form child whose C.FormComponent.label
// reads ComExPlaceOrderForm.label.inventory, and the count is the
// C.StaticInput.static text node in that row. The CX warehouse is the storage
// <select> option labeled "Warehouse"; ship options read "Ship … cargo hold".
// Seen on staging in CXPO RAT.AI1.

const CX_WAREHOUSE_OPTION = 'warehouse';

function onTileReady(tile: PrunTile) {
  const confirmed = new WeakSet<Element>();
  tile.anchor.addEventListener('click', event => onSellClick(tile, confirmed, event), true);
  subscribe($$(tile.anchor, C.ComExPlaceOrderForm.form), form => {
    void overlayInventory(form, tile.parameter);
  });
}

function onSellClick(tile: PrunTile, confirmed: WeakSet<Element>, event: Event) {
  const button = (event.target as Element | null)?.closest?.(`.${C.Button.btn}`);
  if (!button || button.textContent?.trim().toUpperCase() !== 'SELL') {
    return;
  }
  if (confirmed.has(button)) {
    confirmed.delete(button);
    return;
  }
  const parsed = parseCxpo(tile.parameter);
  const form = tile.anchor.querySelector(`.${C.ComExPlaceOrderForm.form}`);
  const amount = readQuantity(form);
  if (!parsed || amount === undefined || !warehouseSelected(form)) {
    return;
  }
  const shortfall = routeStockShortfall(cxStoreForExchange(parsed.exchange), {
    [parsed.ticker]: amount,
  });
  if (!shortfall) {
    return;
  }
  event.stopImmediatePropagation();
  event.preventDefault();
  const message = shortfall.draws
    .map(draw => describeRouteStockDraw(shortfall.exchange, draw))
    .join('. ');
  showConfirmationOverlay(
    tile.anchor,
    () => {
      confirmed.add(button);
      void clickElement(button as HTMLElement);
    },
    { message: `${message}.`, confirmLabel: 'Sell anyway' },
  );
}

async function overlayInventory(form: HTMLElement, parameter: string | undefined) {
  const parsed = parseCxpo(parameter);
  const select = form.querySelector('select');
  if (!parsed || !(select instanceof HTMLSelectElement)) {
    return;
  }
  const order = parsed;
  const row = inventoryRow(form);
  if (!row) {
    return;
  }
  const valueEl = await $(row, C.StaticInput.static);
  const selection = ref(selectedStorage(select));
  const revision = ref(0);
  const syncSelection = () => {
    selection.value = selectedStorage(select);
  };
  select.addEventListener('change', syncSelection);
  const selectObserver = new MutationObserver(syncSelection);
  selectObserver.observe(select, { attributes: true, childList: true, subtree: true });
  const textObserver = new MutationObserver(() => {
    revision.value += 1;
  });
  textObserver.observe(valueEl, { characterData: true, childList: true, subtree: true });
  const gameText = new WeakMap<Text, string>();

  watchEffectWhileNodeAlive(form, () => {
    applyInventory(revision.value);
  });

  function applyInventory(generation: number) {
    if (generation !== revision.value) {
      return;
    }
    const warehouse = selection.value.trim().toLowerCase() === CX_WAREHOUSE_OPTION;
    const reserve = cxRouteReserve(Date.now())[order.exchange]?.[order.ticker];
    const stock = warehouseAmount(order.exchange, order.ticker);
    const label = warehouse && stock !== undefined ? cxpoInventoryLabel(stock, reserve) : undefined;
    const node = amountNode(valueEl);
    if (!node) {
      return;
    }
    paintInventory(node, label, gameText);
  }

  onNodeDisconnectedLazy(form, () => {
    select.removeEventListener('change', syncSelection);
    selectObserver.disconnect();
    textObserver.disconnect();
  });
}

function paintInventory(node: Text, label: string | undefined, gameText: WeakMap<Text, string>) {
  const current = node.data.trim();
  if (!isCxpoInventoryLabel(current)) {
    gameText.set(node, node.data);
  }
  if (label === undefined) {
    const saved = gameText.get(node);
    if (saved !== undefined && isCxpoInventoryLabel(current)) {
      node.data = saved;
    }
    return;
  }
  if (node.data !== label) {
    node.data = label;
  }
}

function amountNode(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent?.trim() ?? '';
    if (isCxpoInventoryLabel(text) || /\d/.test(text)) {
      return node as Text;
    }
    node = walker.nextNode();
  }
  return undefined;
}

function inventoryRow(form: HTMLElement) {
  const wanted = new Set(
    [L.ComExPlaceOrderForm.label.inventory(), 'Inventory'].filter(x => x).map(x => x!.trim()),
  );
  for (const child of Array.from(form.children)) {
    const label = child.querySelector(`.${C.FormComponent.label}, label`);
    if (label && wanted.has(label.textContent?.trim() ?? '')) {
      return child as HTMLElement;
    }
  }
  return undefined;
}

function selectedStorage(select: HTMLSelectElement) {
  return select.selectedOptions[0]?.text ?? '';
}

// A sell from a ship cargo hold leaves the CX warehouse untouched.
function warehouseSelected(form: Element | null) {
  const select = form?.querySelector('select');
  return (
    select instanceof HTMLSelectElement &&
    selectedStorage(select).trim().toLowerCase() === CX_WAREHOUSE_OPTION
  );
}

function parseCxpo(parameter: string | undefined) {
  const parts = parameter?.split('.');
  if (!parts || !parts[0] || !parts[1]) {
    return undefined;
  }
  return { ticker: parts[0].toUpperCase(), exchange: parts[1].toUpperCase() };
}

function readQuantity(form: Element | null) {
  if (!form) {
    return undefined;
  }
  const input = form.querySelector('input');
  if (!(input instanceof HTMLInputElement)) {
    return undefined;
  }
  const raw = input.value.trim().replace(/,/g, '');
  if (raw === '') {
    return 0;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : undefined;
}

// The tile parameter is TICKER.MIC. The warehouse is stored under the station
// natural id, which the exchange code resolves to.
function cxStoreForExchange(exchange: string) {
  const naturalId = exchangesStore.getNaturalIdFromCode(exchange);
  return cxWarehouseStoreAt(naturalId ?? exchange);
}

function warehouseAmount(exchange: string, ticker: string) {
  const store = cxStoreForExchange(exchange);
  if (store === undefined) {
    return undefined;
  }
  return store.items.find(item => item.quantity?.material.ticker === ticker)?.quantity?.amount ?? 0;
}

function init() {
  tiles.observe('CXPO', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CXPO: Confirms a sell that would draw the CX warehouse below its route reserve, and shows reserved and free stock in the inventory row.',
);
