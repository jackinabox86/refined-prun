import { applyWaypointQuery } from '@src/infrastructure/prun-ui/utils/address-query';
import { changeInputValue, clickElement, focusElement } from '@src/util';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import { getSystemLineFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { waitFor } from '@src/utils/wait-for';

// The station store keys getByNaturalId by the station's OWN natural id
// ("MOR" for Moria Station), but the AddressSelector canonicalizes a picked
// station to its SYSTEM id ("OT-580") — resolving the form value needs a
// search by the address's system line instead.
export function findStationBySystemId(id: string) {
  const needle = id.toUpperCase();
  return stationsStore.all.value?.find(
    x => getSystemLineFromAddress(x.address)?.entity.naturalId.toUpperCase() === needle,
  );
}

// AddressSelector suggestions are rendered in #autosuggest-portal outside the
// tile DOM. Only one portal can be open at a time, so we search it directly.
// Typing fires a read-only NOMENCLATURE_QUERY_ADDRESSES lookup to the game
// server; selecting a suggestion is pure local form state.
// `waypoint` is the route editor only. Other callers keep the class match.
export interface SelectAddressOptions {
  waypoint?: boolean;
}

export async function selectAddress(
  container: Element,
  locationName: string,
  options?: SelectAddressOptions,
): Promise<boolean> {
  if (options?.waypoint === true) {
    return selectWaypointAddress(container, locationName);
  }
  return selectStoredAddress(container, locationName);
}

async function selectStoredAddress(container: Element, locationName: string): Promise<boolean> {
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

function waypointSuggestions(input: HTMLElement): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  const portal = document.getElementById('autosuggest-portal');
  if (portal !== null) {
    const options = Array.from(portal.querySelectorAll('[role="option"]')) as HTMLElement[];
    nodes.push(
      ...(options.length > 0
        ? options
        : (_$$(portal, C.AddressSelector.suggestionContent) as HTMLElement[])),
    );
  }
  const list = input.closest('[role="combobox"]')?.querySelector('[role="listbox"]');
  if (list !== null && list !== undefined) {
    nodes.push(...(Array.from(list.querySelectorAll('[role="option"]')) as HTMLElement[]));
  }
  return nodes;
}

// A new route field ignores synthetic input events, so this path calls the
// component's own onChange. The route editor presses the row's React handler.
async function selectWaypointAddress(container: Element, locationName: string): Promise<boolean> {
  const input = _$(container, C.AddressSelector.input) as HTMLInputElement | undefined;
  if (input === undefined) {
    return false;
  }
  const query =
    findStationBySystemId(locationName)?.name ??
    stationsStore.getByNaturalId(locationName)?.name ??
    locationName;

  input.focus();
  focusElement(input);
  const applied = applyWaypointQuery(input, query);
  if (!applied.ok) {
    console.warn(`Waypoint field has no change handler (${applied.handlers.join(', ') || 'none'})`);
    return false;
  }

  const boundary = new RegExp(`(^|\\W)${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i');
  const suggestions = () => waypointSuggestions(input);
  const findBoundaryMatch = () => suggestions().find(s => boundary.test(s.textContent ?? ''));
  await waitFor(() => !!findBoundaryMatch(), 8000);
  const match =
    findBoundaryMatch() ??
    suggestions().find(s => s.textContent?.trim().toLowerCase().includes(query.toLowerCase()));
  return match !== undefined;
}
