import {
  changeInputValue,
  changeSelectIndex,
  clickElement,
  focusElement,
  selectMaterialInMaterialSelector,
} from '@src/util';
import { sleep } from '@src/utils/sleep';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import { getSystemLineFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { getMaterialByName } from '@src/infrastructure/prun-ui/i18n';
import { ContractDraftSpec, MaterialEntry, TemplateType } from './parsers';

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

// The template select also offers LOAN_INTEREST, LOAN_ANNUITY, and
// LOAN_STABLE; the spec doesn't model loan fields, so export refuses them.
export function isLoanTemplate(anchor: Element): boolean {
  return findTemplateSelect(anchor)?.value.startsWith('LOAN') ?? false;
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

// The currency select is the one whose non-empty option values are all
// 3-letter currency codes (AIC/CIS/ICA/NCC) — non-empty because the select
// leads with a blank placeholder option. The template-type select fails the
// test on its LOAN_* options, the store select on its store-id option values.
function findAnyCurrencySelect(anchor: Element) {
  return (_$$(anchor, 'select') as HTMLSelectElement[]).find(select => {
    if (select.options.length < 2) {
      return false;
    }
    const values = Array.from(select.options)
      .map(option => option.value)
      .filter(value => value !== '');
    return values.length > 0 && values.every(value => /^[A-Z]{3}$/.test(value));
  });
}

// The station store keys getByNaturalId by the station's OWN natural id
// ("MOR" for Moria Station), but the AddressSelector canonicalizes a picked
// station to its SYSTEM id ("OT-580") — resolving the form value needs a
// search by the address's system line instead.
function findStationBySystemId(id: string) {
  const needle = id.toUpperCase();
  return stationsStore.all.value?.find(
    x => getSystemLineFromAddress(x.address)?.entity.naturalId.toUpperCase() === needle,
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

  // Bare station/system ids are un-typeable: a station suggestion renders as
  // "Moria Station (Moria)" — its id never appears as suggestion text, so a
  // pasted "OT-580" would only ever substring-match a moon like OT-580e.
  // Translate the id to the station name up front, looking up by system id
  // (what the form and exports hold) and by station id (a hand-written
  // "MOR"). Planet ids (OT-580b) do render in suggestions and pass through
  // untouched.
  const query =
    findStationBySystemId(locationName)?.name ??
    stationsStore.getByNaturalId(locationName)?.name ??
    locationName;

  focusElement(input);
  changeInputValue(input, query);

  // The portal first renders a default list (own bases, warehouses, CX
  // stations) for the empty focus query, and the typed query's search results
  // only arrive after a server round-trip — so wait for an entry that actually
  // matches the name instead of clicking into the stale default list. Matching
  // requires a word boundary around the query, because natural ids prefix each
  // other ("OT-580b" is a prefix of nothing, but "OT-580" prefixes every moon
  // in the system, and the default list can hold several) — a boundary match
  // hits "Montem (OT-580b)" but not "OT-580br". Only when no boundary match
  // arrives within the timeout does a plain substring match get one shot,
  // keeping tolerance for odd human-entered fragments. No match at all leaves
  // the field for the user rather than guessing.
  const boundary = new RegExp(`(^|\\W)${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i');
  const suggestions = () => _$$(portal, C.AddressSelector.suggestionContent) as HTMLElement[];
  const findBoundaryMatch = () => suggestions().find(s => boundary.test(s.textContent ?? ''));
  await waitFor(() => !!findBoundaryMatch(), 5000);
  const match =
    findBoundaryMatch() ??
    suggestions().find(s => s.textContent?.trim().toLowerCase().includes(query.toLowerCase()));
  if (!match) {
    return false;
  }

  await clickElement(match);
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
// A string matches an option by exact value (store id) or by text substring
// (store name); `true` picks the first real store (index 1), `false` picks
// the "no auto-provision" default at index 0 (value "none", text "--";
// verified live) — the boolean forms are the portable ones, since store
// names/ids are account-specific.
export async function setAutoProvision(anchor: Element, store: string | boolean): Promise<boolean> {
  const findSelect = () => {
    const select = _$(anchor, C.StoreSelect.container) as HTMLSelectElement | undefined;
    return select && select.options.length > 1 ? select : undefined;
  };
  const ready = await waitFor(() => !!findSelect(), 5000);
  if (!ready) {
    return false;
  }
  const select = findSelect()!;
  if (typeof store === 'boolean') {
    changeSelectIndex(select, store ? 1 : 0);
    return true;
  }
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

function readInputNumber(input: HTMLInputElement | null | undefined): number | undefined {
  const text = input?.value.trim();
  if (!text) {
    return undefined;
  }
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Reads the whole template form back into a spec — the inverse of the fillers
// above, all local DOM reads. Empty/unset fields are omitted so the exported
// JSON carries only what the form holds. Loan templates aren't representable
// (the spec has no loan fields); callers check isLoanTemplate() first, and
// this returns an undefined type for them. The AddressSelector inputs hold
// canonicalized natural ids (e.g. OT-580b), which round-trip through import.
export function readDraftSpec(anchor: Element): ContractDraftSpec {
  const spec: ContractDraftSpec = { materials: [] };

  const type = currentTemplateType(anchor);
  if (type) {
    spec.type = type;
  }

  const currency = findAnyCurrencySelect(anchor)?.value;
  if (currency) {
    spec.currency = currency;
  }

  const addresses = _$$(anchor, C.AddressSelector.container);
  const addressValue = (index: number) => {
    const container = addresses.at(index);
    const input = container
      ? (_$(container, C.AddressSelector.input) as HTMLInputElement | undefined)
      : undefined;
    const value = input?.value.trim();
    if (!value) {
      return undefined;
    }
    // Picking a suggestion canonicalizes the input to a natural id: OT-580b
    // for a planet, but the SYSTEM id OT-580 for a station — while the
    // station store keys by the station's own id ("MOR"), hence the
    // system-id search first. Export the entity name instead — readable in
    // shared JSON, and it re-imports through the name path (bare station ids
    // never appear as autosuggest text). Free text that isn't a known id
    // passes through.
    return (
      findStationBySystemId(value)?.name ??
      stationsStore.getByNaturalId(value)?.name ??
      planetsStore.getByNaturalId(value)?.name ??
      value
    );
  };
  if (type === 'SHIP') {
    spec.origin = addressValue(0);
    spec.destination = addressValue(1);
  } else {
    spec.location = addressValue(0);
  }

  const groups = _$$(anchor, C.TemplateSelection.group);

  if (type === 'SHIP') {
    // Inverse of setShipPrice: the single price field is charged once per
    // shipment row, so the contract total is price × rows.
    const priceInput = (anchor.querySelector('input[name="price"]') ??
      findDecimalInputOutsideGroups(anchor)) as HTMLInputElement | null;
    const price = readInputNumber(priceInput);
    if (price !== undefined) {
      spec.payment = price * Math.max(1, groups.length);
    }

    // Option 0 of the store select is the "no auto-provision" default
    // (value "none", text "--"; verified live), so any later index means the
    // toggle is on. Exported as a boolean because store names/ids don't
    // transfer between accounts.
    const storeSelect = _$(anchor, C.StoreSelect.container) as HTMLSelectElement | undefined;
    if (storeSelect && storeSelect.selectedIndex > 0) {
      spec.autoProvision = true;
    }
  }

  spec.deadline = readInputNumber(
    anchor.querySelector('input[name="deadline"]') as HTMLInputElement | null,
  );

  for (const group of groups) {
    // After a pick the game removes the commodity icon from the group and
    // rewrites the MaterialSelector input to the i18n DISPLAY name ("Basic
    // Rations") — not the API's camelCase internal name ("basicRations")
    // that materialsStore.getByName is keyed by. getMaterialByName is built
    // from the game's i18n table with exact display names as keys, so it is
    // the lookup that matches; the ticker fallback covers an input still
    // holding a typed ticker. Groups whose input is empty or resolves to no
    // material carry no commodity.
    const selector = _$(group, C.MaterialSelector.container);
    const value = selector
      ? (_$(selector, 'input') as HTMLInputElement | undefined)?.value.trim()
      : undefined;
    const material = getMaterialByName(value) ?? materialsStore.getByTicker(value);
    if (!material) {
      continue;
    }
    const ticker = material.ticker;
    const amount =
      readInputNumber(
        group.querySelector('input[inputmode="numeric"]') as HTMLInputElement | null,
      ) ?? 0;
    const price =
      type === 'SHIP'
        ? undefined
        : readInputNumber(
            group.querySelector('input[inputmode="decimal"]') as HTMLInputElement | null,
          );
    spec.materials.push({ ticker, amount, price });
  }

  // Reinsert materials last so the exported JSON lists the contract-wide
  // fields before the (potentially long) material array.
  const { materials, ...fields } = spec;
  return { ...fields, materials };
}
