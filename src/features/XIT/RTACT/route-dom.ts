import { routeUsagePercent } from '@src/features/XIT/RTACT/route-usage';
import {
  editorTitle,
  sourceLabel,
  stepCommandLabel,
  tankLabel,
  type RefuelLimit,
  type RouteStep,
  type UnloadLimit,
  type LoadLimit,
} from '@src/features/XIT/RTACT/route-spec';
import {
  amountRowIndex,
  assertEditorClick,
  blockIndex,
  controlLabelOf,
  isAddWaypointArmed,
  isRouteLoopText,
  isStepEditLabel,
  limitClick,
  loopSwitchLit,
  modeRowIndex,
  newRouteId,
  pickSuggestion,
  routeIdsInCells,
  selectControlLabel,
  shipAssignment,
  waypointFieldIndex,
  type ShipAssignment,
  type LimitNode,
  type NamedControl,
} from '@src/features/XIT/RTACT/route-controls';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import {
  addressQuery,
  findStationBySystemId,
  selectAddress,
} from '@src/infrastructure/prun-ui/utils/select-address';
import {
  changeSelectIndex,
  clickAtCenter,
  clickElement,
  selectAndChangeInputValue,
  selectMaterialInMaterialSelector,
} from '@src/util';
import { sleep } from '@src/utils/sleep';
import { waitFor } from '@src/utils/wait-for';

function controlElements(root: Element): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const el of Array.from(root.querySelectorAll('button, a, [role="button"]'))) {
    found.add(el as HTMLElement);
  }
  for (const el of _$$(root, C.Button.btn)) {
    found.add(el);
  }
  return [...found];
}

function isDisabled(el: Element): boolean {
  if (el instanceof HTMLButtonElement && el.disabled) {
    return true;
  }
  if (el.getAttribute('aria-disabled') === 'true') {
    return true;
  }
  return el.classList.contains(C.Button.disabled);
}

function namedControls(root: Element): { el: HTMLElement; control: NamedControl }[] {
  return controlElements(root).map(el => ({
    el,
    control: {
      label: controlLabelOf(el),
      disabled: isDisabled(el),
      neutral: el.classList.contains(C.Button.neutral),
      danger: el.classList.contains(C.Button.danger),
    },
  }));
}

export function hasControl(root: Element, label: string): boolean {
  try {
    selectControlLabel(
      namedControls(root).map(row => row.control),
      label,
    );
    return true;
  } catch {
    return false;
  }
}

export async function clickControl(
  root: Element,
  label: string,
  opts?: { requireArmed?: boolean },
): Promise<void> {
  const rows = namedControls(root);
  const chosen = selectControlLabel(
    rows.map(row => row.control),
    label,
    opts,
  );
  const match = rows.find(
    row =>
      row.control.label.toLowerCase() === chosen.toLowerCase() &&
      !/delete/i.test(row.control.label) &&
      row.control.danger !== true,
  );
  if (match === undefined) {
    throw new Error(`Control not found: ${label}`);
  }
  await clickElement(match.el);
}

function screenBox(el: HTMLElement): { x: number; y: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function onScreen(el: HTMLElement): boolean {
  const box = screenBox(el);
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.y + box.height > 0 &&
    box.x + box.width > 0 &&
    box.y < window.innerHeight &&
    box.x < window.innerWidth
  );
}

// Another window can hold an Enter location field. Only the one sitting on
// ADD WAYPOINT opens the route suggestion list.
function locationInput(root: Element): HTMLInputElement | undefined {
  const inputs = (_$$(root, C.AddressSelector.input) as HTMLInputElement[]).filter(
    field => field.placeholder.trim().toLowerCase() === 'enter location' && onScreen(field),
  );
  const buttons = Array.from(root.querySelectorAll('button')).filter(button => {
    const label = (button.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    return label === 'add waypoint' && onScreen(button);
  });
  const index = waypointFieldIndex(inputs.map(screenBox), buttons.map(screenBox));
  return index === undefined ? undefined : inputs[index];
}

export function locationContainer(anchor: Element): Element | undefined {
  const input = locationInput(anchor);
  if (input === undefined) {
    return undefined;
  }
  return input.closest(`.${C.AddressSelector.container}`) ?? input.parentElement ?? undefined;
}

export function locationValue(anchor: Element): string {
  return locationInput(anchor)?.value.trim() ?? '';
}

export function addWaypointArmed(anchor: Element): boolean {
  const rows = namedControls(anchor);
  const add = rows.find(row => row.control.label.toLowerCase() === 'add waypoint');
  if (add === undefined) {
    return false;
  }
  return isAddWaypointArmed({
    disabled: add.control.disabled === true,
    neutral: add.control.neutral === true,
    danger: add.control.danger === true,
  });
}

async function pickLocationOnce(anchor: Element, query: string): Promise<boolean> {
  const container = locationContainer(anchor) ?? locationContainer(document.body);
  if (container === undefined) {
    return false;
  }
  const picked = await selectAddress(container, query, { waypoint: true });
  if (!picked) {
    return false;
  }
  // The shared helper only confirms the row. This screen's click is the React handler.
  return pressWaypointSuggestion(anchor, addressQuery(query));
}

function suggestionNodes(input: HTMLElement): HTMLElement[] {
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

async function pressWaypointSuggestion(anchor: Element, query: string): Promise<boolean> {
  const input = locationInput(anchor) ?? locationInput(document.body);
  if (input === undefined) {
    return false;
  }
  const labels = suggestionNodes(input).map(node =>
    (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
  const chosen = pickSuggestion(labels, query);
  if (chosen === undefined) {
    return false;
  }
  const match = suggestionNodes(input).find(
    node => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === chosen,
  );
  if (match === undefined) {
    return false;
  }
  const onClick = suggestionOnClick(match);
  if (onClick !== undefined) {
    onClick({
      target: match,
      currentTarget: match,
      preventDefault() {},
      stopPropagation() {},
      persist() {},
      nativeEvent: { isTrusted: true, button: 0, detail: 1 },
    });
    return true;
  }
  await clickAtCenter(match);
  return true;
}

function suggestionOnClick(start: HTMLElement): ((event: object) => void) | undefined {
  const record = start as unknown as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  for (let depth = 0; depth < 8 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const props = (fiber as { memoizedProps?: unknown; return?: unknown }).memoizedProps;
    if (
      props !== null &&
      typeof props === 'object' &&
      typeof (props as { onClick?: unknown }).onClick === 'function'
    ) {
      return (props as { onClick: (event: object) => void }).onClick;
    }
    fiber = (fiber as { return?: unknown }).return;
  }
  return undefined;
}

export async function pickLocation(anchor: Element, query: string): Promise<boolean> {
  // The new route tile lays out after the create click. Wait until its own
  // field is on screen beside ADD WAYPOINT. Another window's field does not count.
  await waitFor(
    () => locationContainer(anchor) !== undefined || locationContainer(document.body) !== undefined,
    5000,
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await pickLocationOnce(anchor, query)) {
      const armed = await waitFor(() => addWaypointArmed(anchor), 10000);
      if (armed) {
        return true;
      }
    }
    await sleep(200);
  }
  return false;
}

function textIncludes(el: Element, needle: string): boolean {
  return (el.textContent ?? '').toLowerCase().includes(needle.toLowerCase());
}

function hasStepCommand(el: Element): boolean {
  return controlElements(el).some(control => {
    const label = controlLabelOf(control).toLowerCase();
    return label === 'load' || label === 'unload' || label === 'refuel' || label === 'wait';
  });
}

export function findWaypointScope(anchor: Element, needles: string[]): Element | undefined {
  const wanted = needles.map(needle => needle.trim()).filter(needle => needle.length > 0);
  if (wanted.length === 0) {
    return undefined;
  }
  const matches = Array.from(anchor.querySelectorAll('*')).filter(el => {
    const hit = wanted.some(needle => textIncludes(el, needle));
    if (!hit) {
      return false;
    }
    return textIncludes(el, 'no steps yet') || hasStepCommand(el);
  });
  if (matches.length === 0) {
    return undefined;
  }
  const last = matches[matches.length - 1];
  const inner = Array.from(last.querySelectorAll('*')).filter(el => {
    const hit = wanted.some(needle => textIncludes(el, needle));
    return hit && (textIncludes(el, 'no steps yet') || hasStepCommand(el));
  });
  inner.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
  return inner[0] ?? last;
}

function countStepEdits(el: Element): number {
  return controlElements(el).filter(control => isStepEditLabel(controlLabelOf(control))).length;
}

// The step pencil is a sibling of the header row, so the header itself does not
// contain it. The block is the first ancestor that does.
export function waypointBlock(header: Element): Element {
  const nodes: Element[] = [];
  const counts: number[] = [];
  let current: Element | null = header;
  while (current !== null && nodes.length < 8) {
    nodes.push(current);
    counts.push(countStepEdits(current));
    current = current.parentElement;
  }
  return nodes[blockIndex(counts)] ?? header;
}

export function stationName(query: string, canonical: string): string | undefined {
  const ids = [canonical, query].map(value => value.trim()).filter(value => value.length > 0);
  for (const id of ids) {
    const bySystem = findStationBySystemId(id);
    const name = bySystem?.name.trim() ?? '';
    if (name.length > 0) {
      return name;
    }
  }
  for (const id of ids) {
    const byTicker = stationsStore.getByNaturalId(id);
    const name = byTicker?.name.trim() ?? '';
    if (name.length > 0) {
      return name;
    }
  }
  return undefined;
}

export function revealHover(el: Element): void {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
}

export function stepEdits(scope: Element): HTMLElement[] {
  return controlElements(scope).filter(el => isStepEditLabel(controlLabelOf(el)));
}

export function findStepEdit(scope: Element): HTMLElement | undefined {
  const edits = stepEdits(scope);
  return edits[edits.length - 1];
}

export function findEditor(anchor: Element, title: string): Element | undefined {
  // The editor text joins its buttons (`CANCELSAVE`), so SAVE must be an element's whole text.
  const saves = Array.from(anchor.querySelectorAll('*')).filter(
    el => (el.textContent ?? '').trim().toLowerCase() === 'save',
  );
  const matches = Array.from(anchor.querySelectorAll('*')).filter(el => {
    const text = el.textContent ?? '';
    return (
      text.toLowerCase().includes(title.toLowerCase()) && saves.some(save => el.contains(save))
    );
  });
  matches.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
  return matches[0];
}

// SAVE is the editor's only commit control. Its element's whole text is `SAVE`; CANCEL and
// delete sit beside it, so match exactly and never fall back to a substring.
export async function clickEditorSave(editor: Element): Promise<void> {
  const saves = Array.from(editor.querySelectorAll('*')).filter(
    el => (el.textContent ?? '').trim().toLowerCase() === 'save',
  );
  const target = saves[saves.length - 1] as HTMLElement | undefined;
  if (target === undefined) {
    throw new Error('Could not find SAVE in the step editor');
  }
  await clickElement(target);
}

export function snapshotRouteIds(anchor: Element): string[] {
  return routeIdsInCells(Array.from(anchor.querySelectorAll('*'), el => el.textContent ?? ''));
}

export async function waitForNewRouteId(
  anchor: Element,
  before: string[],
): Promise<string | undefined> {
  let created: string | undefined;
  await waitFor(() => {
    created = newRouteId(before, snapshotRouteIds(anchor));
    return created !== undefined;
  }, 8000);
  return created;
}

function amountInputs(root: Element): HTMLInputElement[] {
  return Array.from(root.querySelectorAll('input')).filter((el): el is HTMLInputElement => {
    const input = el as HTMLInputElement;
    const mode = input.getAttribute('inputmode');
    return mode === 'decimal' || mode === 'numeric' || input.type === 'number';
  });
}

function collectLimitNodes(editor: Element): { nodes: LimitNode[]; elements: Element[] } {
  const elements = [editor, ...Array.from(editor.querySelectorAll('*'))];
  const indexOf = new Map<Element, number>();
  for (let i = 0; i < elements.length; i++) {
    indexOf.set(elements[i], i);
  }
  const nodes = elements.map(el => {
    const parentEl = el.parentElement;
    const parent = parentEl === null ? undefined : indexOf.get(parentEl);
    return {
      text: el.textContent ?? '',
      inputs: amountInputs(el).length,
      parent,
    };
  });
  return { nodes, elements };
}

async function clickModeWord(root: Element, label: string): Promise<void> {
  assertEditorClick(label);
  const wanted = label.trim().toLowerCase();
  const matches = Array.from(root.querySelectorAll('*')).filter(el => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text === wanted;
  });
  let target: Element | undefined;
  let bestLen = Infinity;
  for (const el of matches) {
    const len = (el.textContent ?? '').length;
    if (target === undefined || len <= bestLen) {
      target = el;
      bestLen = len;
    }
  }
  if (target === undefined) {
    throw new Error(`Control not found: ${label}`);
  }
  await clickElement(target as HTMLElement);
}

async function chooseOption(editor: Element, optionText: string): Promise<boolean> {
  const selects = Array.from(editor.querySelectorAll('select')) as HTMLSelectElement[];
  for (const select of selects) {
    const index = Array.from(select.options).findIndex(
      option => option.text.trim().toLowerCase() === optionText.toLowerCase(),
    );
    if (index < 0) {
      continue;
    }
    if (select.selectedIndex !== index) {
      changeSelectIndex(select, index);
    }
    return true;
  }
  return false;
}

async function applyLimit(
  editor: Element,
  heading: string,
  limit: LoadLimit | UnloadLimit | RefuelLimit,
): Promise<void> {
  const first = collectLimitNodes(editor);
  const modeIndex = modeRowIndex(first.nodes, heading);
  if (modeIndex === undefined) {
    throw new Error(`Could not find the ${heading} row`);
  }
  const modeRow = first.elements[modeIndex];
  const hasAmount = () => amountRowIndex(collectLimitNodes(editor).nodes, heading) !== undefined;
  const click = limitClick(hasAmount(), limit.mode);
  if (click !== undefined) {
    await clickModeWord(modeRow, click);
    if (limit.mode === 'units') {
      await waitFor(hasAmount, 2000);
    }
  }
  if (limit.mode !== 'units') {
    return;
  }
  const after = collectLimitNodes(editor);
  const amountIndex = amountRowIndex(after.nodes, heading);
  const amountRow = amountIndex === undefined ? undefined : after.elements[amountIndex];
  const input = amountRow === undefined ? undefined : amountInputs(amountRow)[0];
  if (input === undefined) {
    throw new Error(`Could not find the ${heading} amount`);
  }
  selectAndChangeInputValue(input, String(limit.amount));
}

async function fillMaterial(editor: Element, ticker: string): Promise<void> {
  const selected = await selectMaterialInMaterialSelector(editor, ticker);
  if (selected) {
    return;
  }
  const portal = document.getElementById('autosuggest-portal');
  if (portal === null) {
    throw new Error(`Could not pick material ${ticker}`);
  }
  const labels = _$$(portal, C.AddressSelector.suggestionContent).map(
    el => el.textContent?.trim() ?? '',
  );
  const chosen = pickSuggestion(labels, ticker);
  if (chosen === undefined) {
    throw new Error(`Could not pick material ${ticker}`);
  }
  const match = _$$(portal, C.AddressSelector.suggestionContent).find(
    el => (el.textContent ?? '').trim() === chosen,
  );
  if (match === undefined) {
    throw new Error(`Could not pick material ${ticker}`);
  }
  await clickElement(match as HTMLElement);
}

export async function fillStepEditor(editor: Element, step: RouteStep): Promise<void> {
  if (step.kind === 'load' || step.kind === 'unload') {
    await fillMaterial(editor, step.ticker);
    await applyLimit(editor, 'Minimum', step.min);
    await applyLimit(editor, 'Maximum', step.max);
    return;
  }
  if (step.kind === 'wait') {
    const selected = await chooseOption(editor, step.unit);
    if (!selected) {
      throw new Error(`Could not set wait unit to ${step.unit}`);
    }
    const input = amountInputs(editor)[0];
    if (input === undefined) {
      throw new Error('Could not find the wait amount');
    }
    selectAndChangeInputValue(input, String(step.amount));
    return;
  }
  const tank = tankLabel(step.tank);
  const source = sourceLabel(step.source);
  if (!(await chooseOption(editor, tank))) {
    await clickModeWord(editor, tank);
  }
  if (!(await chooseOption(editor, source))) {
    await clickModeWord(editor, source);
  }
  await applyLimit(editor, 'Minimum', step.min);
  await applyLimit(editor, 'Maximum', step.max);
}

export async function waitForEditor(
  anchor: Element,
  step: RouteStep,
): Promise<Element | undefined> {
  const title = editorTitle(step);
  let editor: Element | undefined;
  await waitFor(() => {
    editor = findEditor(anchor, title);
    return editor !== undefined;
  }, 5000);
  return editor;
}

export function commandLabel(step: RouteStep): string {
  return stepCommandLabel(step);
}

// Body rows of the route view's Assignments table, the one whose header has a `Cmds` cell.
function assignmentRows(anchor: Element): HTMLTableRowElement[] {
  const table = Array.from(anchor.querySelectorAll('table')).find(el =>
    Array.from(el.querySelectorAll('th')).some(th => (th.textContent ?? '').trim() === 'Cmds'),
  );
  if (table === undefined) {
    return [];
  }
  return Array.from(table.querySelectorAll('tr')).filter(row => row.querySelector('td') !== null);
}

// The table may show a ship's name or its registration, so accept both. Unnamed ships carry a
// null name, which crashes shipsStore.getByName, so scan the list directly.
export function shipNames(ship: string): string[] {
  const id = ship.trim();
  const wanted = id.toLowerCase();
  const match = (shipsStore.all.value ?? []).find(
    x => x.registration?.toLowerCase() === wanted || x.name?.toLowerCase() === wanted,
  );
  return [id, match?.registration, match?.name].filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  );
}

export function readShipAssignment(
  anchor: Element,
  ship: string,
  routeId: string,
): { state: ShipAssignment; rows: HTMLTableRowElement[] } {
  const rows = assignmentRows(anchor);
  const cells = rows.map(row =>
    Array.from(row.querySelectorAll('td'), td => (td.textContent ?? '').trim()),
  );
  return { state: shipAssignment(cells, shipNames(ship), routeId), rows };
}

// ASSIGN is the row's only control the runner may press; match the whole text exactly.
export async function clickAssign(row: HTMLTableRowElement): Promise<void> {
  const target = controlElements(row).find(
    el =>
      controlLabelOf(el).toUpperCase() === 'ASSIGN' &&
      !isDisabled(el) &&
      !el.classList.contains(C.Button.danger),
  );
  if (target === undefined) {
    throw new Error('Could not find ASSIGN in the ship row');
  }
  await clickElement(target);
}

export const WAYPOINT_EDITOR_TITLE = 'Edit waypoint';

function frameLoopToggle(root: Element): HTMLElement | undefined {
  const toggles = _$$(root, C.Frame.toggle).filter(el => {
    if (_$(el, C.Frame.toggleIndicator) === undefined) {
      return false;
    }
    const label = _$(el, C.Frame.toggleLabel);
    const text = (label ?? el).textContent ?? '';
    return isRouteLoopText(text);
  });
  return toggles[0];
}

// The route settings switch is a small div whose own text is Loop. It is not
// the sidebar Frame.toggle, and the row also has a separate Loop label.
function loopSwitch(root: Element): HTMLElement | undefined {
  const divs = Array.from(root.querySelectorAll('div')).filter(el => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text === 'Loop' && el.getClientRects().length > 0;
  });
  divs.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width);
  return divs[0];
}

export function routeLoopToggle(root: Element): HTMLElement | undefined {
  return frameLoopToggle(root) ?? loopSwitch(root) ?? loopSwitch(document.body);
}

function showsActive(el: Element): boolean {
  return Array.from(el.classList).some(
    name => name.includes('Active') && !name.includes('Disabled'),
  );
}

export function routeLoopOn(toggle: HTMLElement): boolean {
  const indicator = _$(toggle, C.Frame.toggleIndicator);
  if (indicator !== undefined) {
    return showsActive(indicator);
  }
  // The RT Loop switch is a RadioItem. Its indicator beside the label carries
  // the active class. The label color changes on hover, so it is a last resort.
  const radio = toggle.closest(`.${C.RadioItem.container}`) ?? toggle.parentElement;
  const radioIndicator = radio === null ? undefined : _$(radio, C.RadioItem.indicator);
  if (radioIndicator !== undefined) {
    return radioIndicator.classList.contains(C.RadioItem.active);
  }
  return loopSwitchLit(getComputedStyle(toggle).color);
}

// A content-script mouse event does not flip this switch. The slider path
// already calls the component's React handler; this does the same for onClick.
export async function pressLoopSwitch(toggle: HTMLElement): Promise<void> {
  const onClick = reactOnClick(toggle);
  if (onClick !== undefined) {
    onClick({
      isTrusted: true,
      button: 0,
      detail: 1,
      target: toggle,
      currentTarget: toggle,
      preventDefault() {},
      stopPropagation() {},
      persist() {},
      nativeEvent: { isTrusted: true, button: 0, detail: 1 },
    });
    return;
  }
  await clickAtCenter(toggle);
}

function reactOnClick(start: HTMLElement): ((event: object) => void) | undefined {
  const record = start as unknown as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  for (let depth = 0; depth < 8 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const node = fiber as { memoizedProps?: unknown; stateNode?: unknown; return?: unknown };
    const stateNode = node.stateNode;
    const onSwitch =
      stateNode === start ||
      (stateNode instanceof HTMLElement &&
        (start.contains(stateNode) ||
          (stateNode.contains(start) && isRouteLoopText(stateNode.textContent ?? ''))));
    const props = node.memoizedProps;
    if (
      onSwitch &&
      props !== null &&
      typeof props === 'object' &&
      typeof (props as { onClick?: unknown }).onClick === 'function'
    ) {
      return (props as { onClick: (event: object) => void }).onClick;
    }
    fiber = node.return;
  }
  return undefined;
}

export async function fillWaypointFlight(
  editor: Element,
  stop: { fuelUsage?: number; reactorUsage?: number; gateway?: boolean },
  waitAct?: (status: string) => Promise<void>,
): Promise<string> {
  const filled: string[] = [];
  if (stop.fuelUsage !== undefined) {
    const label = flightLabel('fuel');
    const target = usageTarget(editor, label, stop.fuelUsage);
    await setLabeledSlider(editor, label, target);
    filled.push(`fuel ${target}%`);
  }
  if (stop.reactorUsage !== undefined) {
    const label = flightLabel('reactor');
    const target = usageTarget(editor, label, stop.reactorUsage);
    await setReactorUsage(editor, target, waitAct);
    filled.push(`reactor ${target}%`);
  }
  if (stop.gateway !== undefined) {
    await setGateway(editor, stop.gateway);
    filled.push(stop.gateway ? 'gateways on' : 'gateways off');
  }
  return filled.join(', ');
}

function flightLabel(which: 'fuel' | 'reactor') {
  const fromShip =
    which === 'fuel'
      ? L.ShipFlightControl.label.fuelUsage()
      : L.ShipFlightControl.label.reactorUsage();
  if (fromShip !== undefined && fromShip.length > 0) {
    return fromShip;
  }
  return which === 'fuel' ? 'Fuel usage' : 'Reactor usage';
}

function sliderFor(editor: Element, label: string): Element | undefined {
  let best: Element | undefined;
  let bestLength = Infinity;
  const wanted = label.toLowerCase();
  for (const slider of _$$(editor, 'rc-slider')) {
    let node: Element | null = slider;
    for (let depth = 0; depth < 8 && node !== null; depth += 1) {
      const text = node.textContent ?? '';
      if (text.toLowerCase().includes(wanted) && text.length < bestLength) {
        best = slider;
        bestLength = text.length;
      }
      node = node.parentElement;
    }
  }
  return best;
}

function sliderHandle(slider: Element): HTMLElement | undefined {
  const handle = _$(slider, 'rc-slider-handle');
  if (handle instanceof HTMLElement) {
    return handle;
  }
  return undefined;
}

function readNow(handle: HTMLElement): number | undefined {
  const value = Number(handle.getAttribute('aria-valuenow'));
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function usageTarget(editor: Element, label: string, flightFraction: number): number {
  const handle = labeledHandle(editor, label);
  const min = Number(handle.getAttribute('aria-valuemin'));
  const max = Number(handle.getAttribute('aria-valuemax'));
  return routeUsagePercent(flightFraction, { min, max, step: sliderStep(handle) });
}

function sliderStep(handle: HTMLElement): number {
  const step = sliderProps(handle)?.step;
  if (typeof step === 'number' && Number.isFinite(step) && step > 0) {
    return step;
  }
  // Route usage handles move by 1 when they do not expose a step.
  return 1;
}

function sliderProps(handle: HTMLElement): { step?: unknown; onChange?: unknown } | undefined {
  const record = handle as unknown as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  for (let depth = 0; depth < 12 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const props = (fiber as { memoizedProps?: unknown }).memoizedProps;
    if (
      props !== null &&
      typeof props === 'object' &&
      'min' in props &&
      'max' in props &&
      typeof (props as { onChange?: unknown }).onChange === 'function'
    ) {
      return props as { step?: unknown; onChange?: unknown };
    }
    fiber = (fiber as { return?: unknown }).return;
  }
  return undefined;
}

// The waypoint form keeps each usage in a field wrapped around the rc-slider. Only
// that field's value is sent on SAVE. The slider's own onChange, arrow keys, and a
// rail press all move the handle without reaching the field, so SAVE kept 25/50.
// Hand the value to the field itself, then blur it the way a player leaves it.
async function stepSliderTo(editor: Element, label: string, target: number): Promise<boolean> {
  const field = sliderFieldProps(labeledHandle(editor, label));
  if (field === undefined) {
    return false;
  }
  field.onChange(target);
  field.onBlur?.();
  // Nothing here touches the slider, so the handle moving means the field passed it down.
  return await waitFor(() => readNow(labeledHandle(editor, label)) === target, 1000);
}

interface SliderField {
  value?: unknown;
  onChange: (value: number) => void;
  onBlur?: () => void;
}

// Fiber chain from the handle (RT Edit waypoint, staging): handle div, rc-slider
// Handle and Slider (value, min, max, onChange, onChangeComplete), then the form
// field (value, min, max, onChange, onBlur). The field is the first with onBlur.
function sliderFieldProps(handle: HTMLElement): SliderField | undefined {
  const record = handle as unknown as Record<string, unknown>;
  const fiberKey = Object.getOwnPropertyNames(record).find(name =>
    name.startsWith('__reactFiber$'),
  );
  let fiber = fiberKey === undefined ? undefined : record[fiberKey];
  for (let depth = 0; depth < 16 && fiber !== null && typeof fiber === 'object'; depth += 1) {
    const props = (fiber as { memoizedProps?: unknown }).memoizedProps as
      | Record<string, unknown>
      | null
      | undefined;
    if (
      props !== null &&
      typeof props === 'object' &&
      'min' in props &&
      'max' in props &&
      'value' in props &&
      typeof props.onChange === 'function' &&
      typeof props.onBlur === 'function'
    ) {
      return props as unknown as SliderField;
    }
    fiber = (fiber as { return?: unknown }).return;
  }
  return undefined;
}

async function setLabeledSlider(editor: Element, label: string, target: number): Promise<void> {
  const handle = labeledHandle(editor, label);
  const min = Number(handle.getAttribute('aria-valuemin'));
  const max = Number(handle.getAttribute('aria-valuemax'));
  if (!Number.isFinite(min) || !Number.isFinite(max) || target < min || target > max) {
    throw new Error(`${label} cannot take ${target}`);
  }
  if (readNow(handle) === target) {
    return;
  }
  const landed = await stepSliderTo(editor, label, target);
  if (!landed) {
    const now = readNow(labeledHandle(editor, label));
    throw new Error(`${label} stayed at ${now === undefined ? 'empty' : String(now)}`);
  }
}

async function setReactorUsage(
  editor: Element,
  target: number,
  waitAct?: (status: string) => Promise<void>,
): Promise<void> {
  const label = flightLabel('reactor');
  const handle = labeledHandle(editor, label);
  if (readNow(handle) !== target) {
    const min = Number(handle.getAttribute('aria-valuemin'));
    const max = Number(handle.getAttribute('aria-valuemax'));
    if (Number.isFinite(min) && Number.isFinite(max) && target >= min && target <= max) {
      await stepSliderTo(editor, label, target);
    }
  }
  if (readNow(labeledHandle(editor, label)) === target) {
    return;
  }
  if (waitAct !== undefined) {
    await waitAct(`Set Reactor usage to ${target}, then press ACT`);
  }
  if (readNow(labeledHandle(editor, label)) !== target) {
    const now = readNow(labeledHandle(editor, label));
    throw new Error(`${label} stayed at ${now === undefined ? 'empty' : String(now)}`);
  }
}

function labeledHandle(editor: Element, label: string): HTMLElement {
  const slider = sliderFor(editor, label);
  if (slider === undefined) {
    throw new Error(`${label} slider is not on the waypoint`);
  }
  const handle = sliderHandle(slider);
  if (handle === undefined) {
    throw new Error(`Could not find the ${label} handle`);
  }
  return handle;
}

async function setGateway(editor: Element, on: boolean): Promise<void> {
  const select = editor.querySelector('select');
  if (select === null) {
    throw new Error('Route preferences are not on the waypoint');
  }
  const toggle = gatewayLeaf(select);
  if (toggle === undefined) {
    throw new Error('Use gateways is not on the waypoint');
  }
  if (gatewayOn(toggle) === on) {
    return;
  }
  await clickElement(toggle);
  const flipped = await waitFor(() => gatewayOn(toggle) === on, 1500);
  if (!flipped) {
    throw new Error('Use gateways did not change');
  }
}

function gatewayLeaf(select: HTMLSelectElement): HTMLElement | undefined {
  const label = L.RoutePreferencesSelect.label.useGateways();
  const wanted = label !== undefined && label.length > 0 ? label : 'Use gateways';
  let node: Element | null = select.parentElement;
  while (node !== null) {
    const leaves = Array.from(node.querySelectorAll<HTMLElement>('[class*=Check]')).filter(el => {
      if (el.contains(select) || select.contains(el)) {
        return false;
      }
      const text = (el.textContent ?? '').trim();
      if (text.length === 0 || text.length > 48) {
        return false;
      }
      if (!text.toLowerCase().includes(wanted.toLowerCase()) && text !== wanted) {
        return false;
      }
      return !Array.from(el.children).some(child => (child.textContent ?? '').trim() === text);
    });
    const leaf = leaves[0];
    if (leaf !== undefined) {
      return leaf;
    }
    node = node.parentElement;
  }
  return undefined;
}

function gatewayOn(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  for (let depth = 0; depth < 4 && node !== null; depth += 1) {
    const aria = node.getAttribute('aria-checked') ?? node.getAttribute('aria-pressed');
    if (aria === 'true') {
      return true;
    }
    if (aria === 'false') {
      return false;
    }
    if (/active/i.test(node.className) && /check/i.test(node.className)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}
