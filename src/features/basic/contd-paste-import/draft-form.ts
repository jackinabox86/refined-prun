import {
  changeInputValue,
  changeSelectIndex,
  clickElement,
  focusElement,
  selectMaterialInMaterialSelector,
} from '@src/util';
import { sleep } from '@src/utils/sleep';
import { MaterialEntry, TemplateType } from './parsers';

// DOM fillers for the CONTD template panel. Adapted from the helpers in
// src/features/XIT/ACT/action-steps/cont-utils.ts (the ACT contract actions),
// decoupled from ACT's ContDraftContext: each filler takes the tile anchor,
// fills one form field, and reports success. Nothing here clicks "apply
// template", "cancel", or any save button — those are server actions and stay
// with the user.

async function waitFor(condition: () => boolean, timeout = 5000, interval = 100): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (condition()) {
      return true;
    }
    await sleep(interval);
  }
  return false;
}

function findTemplateSelect(anchor: Element) {
  const container = _$(anchor, C.TemplateSelection.templateTypeSelect);
  return container ? (_$(container, 'select') as HTMLSelectElement | undefined) : undefined;
}

export function currentTemplateType(anchor: Element): TemplateType | undefined {
  const value = findTemplateSelect(anchor)?.value;
  return value === 'BUY' || value === 'SELL' || value === 'SHIP' ? value : undefined;
}

// The amount inputs are the one name that differs between the commodity
// (trades[i].amount) and shipment (shipments[i].amount) forms, so they mark
// when the swap after a template type change has rendered.
function amountInputName(type: TemplateType): string {
  return type === 'SHIP' ? 'shipments[0].amount' : 'trades[0].amount';
}

export async function selectTemplateType(anchor: Element, type: TemplateType): Promise<boolean> {
  const select = findTemplateSelect(anchor);
  if (!select) {
    return false;
  }
  const index = Array.from(select.options).findIndex(option => option.value === type);
  if (index < 0) {
    return false;
  }
  if (select.value !== type) {
    changeSelectIndex(select, index);
  }
  return await waitFor(
    () => !!anchor.querySelector(`input[name="${CSS.escape(amountInputName(type))}"]`),
    3000,
  );
}

export async function setCurrency(anchor: Element, currency: string): Promise<boolean> {
  const found = await waitFor(() => !!findCurrencySelect(anchor, currency), 3000);
  if (!found) {
    return false;
  }
  const select = findCurrencySelect(anchor, currency)!;
  const index = Array.from(select.options).findIndex(option => option.value === currency);
  changeSelectIndex(select, index);
  return true;
}

function findCurrencySelect(anchor: Element, currency: string) {
  return (_$$(anchor, 'select') as HTMLSelectElement[]).find(select =>
    Array.from(select.options).some(option => option.value === currency),
  );
}

// AddressSelector suggestions are rendered in #autosuggest-portal outside the
// tile DOM. Only one portal can be open at a time, so we search it directly.
// Typing fires a read-only NOMENCLATURE_QUERY_ADDRESSES lookup to the game
// server; selecting a suggestion is pure local form state.
export async function selectLocation(container: Element, locationName: string): Promise<boolean> {
  const input = _$(container, C.AddressSelector.input) as HTMLInputElement | undefined;
  const portal = document.getElementById('autosuggest-portal');
  if (!input || !portal) {
    return false;
  }

  focusElement(input);
  changeInputValue(input, locationName);

  // The portal first renders a default list (own bases, warehouses, CX
  // stations) for the empty focus query, and the typed query's search results
  // only arrive after a server round-trip — so wait for an entry that actually
  // matches the name instead of clicking into the stale default list. No match
  // within the timeout leaves the field for the user rather than guessing.
  const findMatch = () =>
    (_$$(portal, C.AddressSelector.suggestionContent) as HTMLElement[]).find(s =>
      s.textContent?.trim().toLowerCase().includes(locationName.toLowerCase()),
    );
  const appeared = await waitFor(() => !!findMatch(), 5000);
  if (!appeared) {
    return false;
  }

  await clickElement(findMatch()!);
  return true;
}

// The SHIP template has a single price field the game charges once per
// shipment row, so the total payment is divided evenly across rows (same
// behavior as ACT's CONT_SEND).
export function setShipPrice(anchor: Element, payment: number): boolean {
  const groupCount = _$$(anchor, C.TemplateSelection.group).length;
  const pricePerRow = Math.round(payment / Math.max(1, groupCount));

  const priceInput = (anchor.querySelector('input[name="price"]') ??
    findDecimalInputOutsideGroups(anchor)) as HTMLInputElement | null;
  if (!priceInput) {
    return false;
  }
  focusElement(priceInput);
  priceInput.select();
  changeInputValue(priceInput, String(pricePerRow));
  return true;
}

function findDecimalInputOutsideGroups(anchor: Element) {
  const groups = _$$(anchor, C.TemplateSelection.group);
  return (_$$(anchor, 'input') as HTMLInputElement[]).find(
    input =>
      input.getAttribute('inputmode') === 'decimal' && !groups.some(group => group.contains(input)),
  );
}

// The auto-provision store options populate only after the origin resolves.
// The pasted value matches an option by exact value (store id) or by text
// substring (store name).
export async function setAutoProvision(anchor: Element, store: string): Promise<boolean> {
  const findSelect = () => {
    const select = _$(anchor, C.StoreSelect.container) as HTMLSelectElement | undefined;
    return select && select.options.length > 1 ? select : undefined;
  };
  const ready = await waitFor(() => !!findSelect(), 5000);
  if (!ready) {
    return false;
  }
  const select = findSelect()!;
  const needle = store.toLowerCase();
  const index = Array.from(select.options).findIndex(
    option => option.value === store || option.text.toLowerCase().includes(needle),
  );
  if (index < 0) {
    return false;
  }
  changeSelectIndex(select, index);
  return true;
}

export function setDeadline(anchor: Element, days: number): boolean {
  const input = anchor.querySelector('input[name="deadline"]') as HTMLInputElement | null;
  if (!input) {
    return false;
  }
  focusElement(input);
  input.select();
  changeInputValue(input, String(days));
  return true;
}

function findAddCommodityButton(anchor: Element) {
  return _$$(anchor, 'button').find(btn => {
    const t = btn.textContent?.trim().toLowerCase();
    return t === 'add commodity' || t === 'add shipment';
  }) as HTMLElement | undefined;
}

async function waitForGroupCount(anchor: Element, expected: number, timeout = 2000) {
  await waitFor(() => _$$(anchor, C.TemplateSelection.group).length >= expected, timeout);
}

// Adds/fills commodity or shipment rows. Same job as addMaterials() in
// src/features/XIT/ACT/action-steps/cont-utils.ts (used by the ACT runner),
// kept separate since that helper is coupled to ACT's ContDraftContext.
// Shipment rows have no per-row price input, so the price fill is naturally
// skipped on the SHIP template.
export async function importMaterials(anchor: Element, materials: MaterialEntry[]) {
  for (let i = 0; i < materials.length; i++) {
    let groups = _$$(anchor, C.TemplateSelection.group);
    if (groups.length <= i) {
      await clickElement(findAddCommodityButton(anchor));
      await waitForGroupCount(anchor, i + 1);
      groups = _$$(anchor, C.TemplateSelection.group);
    }

    if (groups.length <= i) {
      continue;
    }
    const group = groups[i];
    const { ticker, amount, price } = materials[i];

    const amountInput = group.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement | null;
    if (amountInput) {
      focusElement(amountInput);
      changeInputValue(amountInput, String(amount));
    }

    if (price !== undefined) {
      const priceInput = group.querySelector(
        'input[inputmode="decimal"]',
      ) as HTMLInputElement | null;
      if (priceInput) {
        focusElement(priceInput);
        changeInputValue(priceInput, String(price));
      }
    }

    const materialSelectorContainer = _$(group, C.MaterialSelector.container);
    if (materialSelectorContainer) {
      await selectMaterialInMaterialSelector(materialSelectorContainer, ticker);
    }
  }
}
