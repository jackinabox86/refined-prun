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
  assertEditorClick,
  controlLabelOf,
  isAddWaypointArmed,
  isStepEditLabel,
  limitClick,
  newRouteId,
  pickSuggestion,
  routeIdsInText,
  selectControlLabel,
  type NamedControl,
} from '@src/features/XIT/RTACT/route-controls';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import {
  changeSelectIndex,
  clickElement,
  selectAndChangeInputValue,
  selectMaterialInMaterialSelector,
} from '@src/util';
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

export function locationContainer(anchor: Element): Element | undefined {
  const input = (_$$(anchor, C.AddressSelector.input) as HTMLInputElement[]).find(
    field => field.placeholder.trim().toLowerCase() === 'enter location',
  );
  if (input === undefined) {
    return undefined;
  }
  return input.closest(`.${C.AddressSelector.container}`) ?? input.parentElement ?? undefined;
}

export function locationValue(anchor: Element): string {
  const input = (_$$(anchor, C.AddressSelector.input) as HTMLInputElement[]).find(
    field => field.placeholder.trim().toLowerCase() === 'enter location',
  );
  return input?.value.trim() ?? '';
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

export async function pickLocation(anchor: Element, query: string): Promise<boolean> {
  const container = locationContainer(anchor);
  if (container === undefined) {
    return false;
  }
  return await selectAddress(container, query);
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

export function revealHover(el: Element): void {
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
}

export function findStepEdit(scope: Element): HTMLElement | undefined {
  const edits = controlElements(scope).filter(el => isStepEditLabel(controlLabelOf(el)));
  return edits[edits.length - 1];
}

export function findEditor(anchor: Element, title: string): Element | undefined {
  const matches = Array.from(anchor.querySelectorAll('*')).filter(el => {
    const text = el.textContent ?? '';
    return text.toLowerCase().includes(title.toLowerCase()) && /\bsave\b/i.test(text);
  });
  matches.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
  return matches[0];
}

export function snapshotRouteIds(anchor: Element): string[] {
  return routeIdsInText(anchor.textContent ?? '');
}

export async function waitForNewRouteId(
  anchor: Element,
  before: string[],
): Promise<string | undefined> {
  let created: string | undefined;
  await waitFor(() => {
    created = newRouteId(before, routeIdsInText(anchor.textContent ?? ''));
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

function findRow(editor: Element, heading: string): Element | undefined {
  const wanted = heading.toLowerCase();
  const labels = Array.from(editor.querySelectorAll('*')).filter(el => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    return text === wanted || text.startsWith(`${wanted} `);
  });
  labels.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
  const label = labels[0];
  if (label === undefined) {
    return undefined;
  }
  let row: Element | null = label;
  for (let i = 0; i < 5 && row !== null; i++) {
    if (
      amountInputs(row).length > 0 ||
      /\b(units|capacity|all carried)\b/i.test(row.textContent ?? '')
    ) {
      return row;
    }
    row = row.parentElement;
  }
  return label.parentElement ?? undefined;
}

async function clickEditorWord(editor: Element, label: string): Promise<void> {
  assertEditorClick(label);
  await clickControl(editor, label);
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
  const row = findRow(editor, heading);
  if (row === undefined) {
    throw new Error(`Could not find the ${heading} row`);
  }
  const click = limitClick(amountInputs(row).length > 0, limit.mode);
  if (click !== undefined) {
    assertEditorClick(click);
    await clickControl(row, click);
    if (limit.mode === 'units') {
      await waitFor(() => amountInputs(row).length > 0, 2000);
    }
  }
  if (limit.mode !== 'units') {
    return;
  }
  const input = amountInputs(row)[0];
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
    await clickEditorWord(editor, tank);
  }
  if (!(await chooseOption(editor, source))) {
    await clickEditorWord(editor, source);
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
