import {
  changeInputValue,
  changeSelectIndex,
  changeTextAreaValue,
  clickElement,
  focusElement,
  selectAndChangeInputValue,
} from '@src/util';
import { sleep } from '@src/utils/sleep';
import { $ } from '@src/utils/select-dom';
import { fixed0 } from '@src/utils/format';
import { contractDraftsStore } from '@src/infrastructure/prun-api/data/contract-drafts';
import { ActionStepExecuteContext, AssertFn } from '@src/features/XIT/ACT/shared-types';
import { maxContractDays, minContractDays } from '@src/features/XIT/ACT/actions/cont-limits';

// The game's own form limits. Generated text is truncated to fit rather than
// silently rejected by the field.
const maxNameLength = 50;
const maxPreambleLength = 250;

// Polls until the callback returns something truthy, then hands that value back.
// Returning the value avoids the find-twice pattern a boolean version forces.
export async function pollUntil<T>(
  produce: () => T,
  timeout: number,
  interval = 100,
): Promise<T | undefined> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const result = produce();
    if (result) {
      return result;
    }
    if (Date.now() >= deadline) {
      return undefined;
    }
    await sleep(interval);
  }
}

const hasText = (text: string) => (x: Element) => x.textContent?.trim().toLowerCase() === text;

function findButton(anchor: Element, text: string) {
  return _$$(anchor, C.Button.btn).find(hasText(text));
}

function truncate(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/**
 * Types a ticker into a MaterialSelector and clicks the matching suggestion.
 * Also used by MTRA_TRANSFER and the ship-unload feature.
 */
export async function selectMaterial(container: Element, ticker: string) {
  const input = (await $(container, C.MaterialSelector.input)) as HTMLInputElement | null;
  if (!input) {
    return false;
  }

  const suggestionsContainer = (await $(
    container,
    C.MaterialSelector.suggestionsContainer,
  )) as HTMLElement | null;

  focusElement(input);
  changeInputValue(input, ticker);

  const suggestionsList = await $(container, C.MaterialSelector.suggestionsList);

  if (suggestionsContainer) {
    suggestionsContainer.style.display = 'none';
  }

  const match = _$$(suggestionsList, C.MaterialSelector.suggestionEntry).find(
    entry => _$(entry, C.ColoredIcon.label)?.textContent === ticker,
  );

  if (!match) {
    if (suggestionsContainer) {
      suggestionsContainer.style.display = '';
    }
    return false;
  }

  await clickElement(match as HTMLElement);
  if (suggestionsContainer) {
    suggestionsContainer.style.display = '';
  }
  await sleep(200);
  return true;
}

/**
 * Finds the "Create New" button in any CONTD tile, clicks it, and waits for the
 * new draft to appear in the store.
 */
export async function createNewDraft(ctx: ActionStepExecuteContext<unknown>) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Looking for Create New button...');

  const findCreateButton = () => {
    for (const tile of tiles.find('CONTD', true)) {
      const button = findButton(tile.anchor, 'create new');
      if (button) {
        return button;
      }
    }
    return undefined;
  };

  const createBtn = await pollUntil(findCreateButton, 10000);
  assert(createBtn, 'Could not find "Create New" button');

  const beforeIds = new Set((contractDraftsStore.all.value ?? []).map(x => x.naturalId));
  await clickElement(createBtn);

  setStatus('Waiting for draft to be created...');
  const newDraft = await pollUntil(
    () => (contractDraftsStore.all.value ?? []).find(x => !beforeIds.has(x.naturalId)),
    8000,
  );
  assert(newDraft, 'Timed out waiting for new contract draft');
  log.info(`New draft created: ${newDraft.naturalId}`);
  return newDraft;
}

/**
 * Sets the contract name (first input) and preamble (textarea) in the draft tile.
 */
export async function setDraftNameAndPreamble(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  name: string,
  preamble: string,
) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Setting contract name...');

  // Poll rather than `await $()`, which has no timeout and would hang the run
  // instead of failing it when the form never renders.
  const nameInput = await pollUntil(() => _$(anchor, 'input'), 5000);
  assert(nameInput, 'Could not find name input');
  selectAndChangeInputValue(nameInput, truncate(name, maxNameLength));
  log.info(`Name set: ${name}`);

  const preambleInput = _$(anchor, 'textarea');
  assert(preambleInput, 'Could not find preamble input');
  focusElement(preambleInput);
  changeTextAreaValue(preambleInput, truncate(preamble, maxPreambleLength));
  log.info('Preamble set');
}

/**
 * Clicks the draft-details save button and waits for the server to echo the
 * saved name and preamble back into the store.
 */
export async function saveDraftDetails(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  draftId: string,
) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Saving draft details...');

  const before = contractDraftsStore.getByNaturalId(draftId);
  // Read back what the form holds rather than what we meant to write, so a
  // field the game reformatted still compares equal.
  const name = _$(anchor, 'input')?.value;
  const preamble = _$(anchor, 'textarea')?.value;
  const saveBtn = findButton(anchor, 'save');
  assert(
    saveBtn !== undefined && !saveBtn.classList.contains(C.Button.disabled),
    'Draft details save button is missing or disabled',
  );
  await clickElement(saveBtn);

  const saved = await pollUntil(() => {
    const draft = contractDraftsStore.getByNaturalId(draftId);
    return (
      draft !== undefined && draft !== before && draft.name === name && draft.preamble === preamble
    );
  }, 8000);
  assert(saved, 'Draft details were not saved');
  log.info('Draft details saved');
}

/**
 * Clicks "Select Template" and returns the template type <select>.
 */
export async function openTemplate(ctx: ActionStepExecuteContext<unknown>, anchor: Element) {
  const assert: AssertFn = ctx.assert;
  const { setStatus } = ctx;

  setStatus('Opening template selection...');

  const templateBtn = await pollUntil(() => findButton(anchor, 'select template'), 5000);
  assert(templateBtn, 'Could not find "Select Template" button');
  await clickElement(templateBtn);

  const templateSelect = await pollUntil(() => {
    const container = _$(anchor, C.TemplateSelection.templateTypeSelect);
    return container === undefined ? undefined : _$(container, 'select');
  }, 5000);
  assert(templateSelect, 'Could not find template type select');
  return templateSelect;
}

// Map stored action values to the game's <select> option values.
const templateValueMap: Record<string, string> = {
  BUYING: 'BUY',
  SELLING: 'SELL',
};

/**
 * Selects a template type (e.g. 'SHIP', 'BUYING', 'SELLING') in the template dropdown.
 */
export function selectTemplateType(
  ctx: ActionStepExecuteContext<unknown>,
  templateSelect: HTMLSelectElement,
  templateValue: string,
) {
  const assert: AssertFn = ctx.assert;
  const mapped = templateValueMap[templateValue] ?? templateValue;
  const index = Array.from(templateSelect.options).findIndex(x => x.value === mapped);
  assert(index >= 0, `Template "${templateValue}" not found in the template select`);
  changeSelectIndex(templateSelect, index);
  ctx.log.info(`Selected "${templateValue}" template`);
}

/**
 * Finds the currency <select> and sets it to the given currency code.
 */
export async function setCurrency(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  currency: string,
) {
  const assert: AssertFn = ctx.assert;
  const { log } = ctx;

  const currencySelect = await pollUntil(
    () => _$$(anchor, 'select').find(x => Array.from(x.options).some(o => o.value === currency)),
    3000,
  );
  assert(currencySelect, `Could not find currency select for ${currency}`);
  const index = Array.from(currencySelect.options).findIndex(x => x.value === currency);
  changeSelectIndex(currencySelect, index);
  log.info(`Currency set to ${currency}`);
}

export interface MaterialEntry {
  ticker: string;
  amount: number;
}

export interface AddMaterialsOptions {
  /** Called after each material row is set up, with the group element and ticker. */
  setPrice?: (group: Element, ticker: string) => void;
}

/**
 * Adds material rows to the contract template. Clicks "Add shipment"/"Add commodity"
 * for rows after the first, sets amount and selects material for each.
 *
 * Same job as importMaterials() in src/features/basic/contd-paste-import/draft-form.ts
 * (the CONTD paste-import feature), kept separate since this one drives an ACT step.
 */
export async function addMaterials(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  materials: MaterialEntry[],
  options?: AddMaterialsOptions,
) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Adding materials to template...');

  const findAddButton = () =>
    _$$(anchor, 'button').find(x => hasText('add shipment')(x) || hasText('add commodity')(x));

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];

    if (i > 0) {
      const addBtn = findAddButton();
      assert(addBtn, `Could not find add button for ${material.ticker}`);
      await clickElement(addBtn);
    }

    // Index the row rather than taking the last one: the template may render
    // rows we did not add, and every entry would then overwrite the same row.
    const group = await pollUntil(() => _$$(anchor, C.TemplateSelection.group).at(i), 2000);
    assert(group, `Could not find group for ${material.ticker}`);

    const amountInput = group.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    assert(amountInput, `Could not find amount input for ${material.ticker}`);
    selectAndChangeInputValue(amountInput, String(material.amount));

    const matSelector = _$(group, C.MaterialSelector.container);
    assert(matSelector, `Could not find material selector for ${material.ticker}`);
    const selected = await selectMaterial(matSelector, material.ticker);
    assert(selected, `Could not select material ${material.ticker}`);
    log.info(`Added: ${material.ticker} x${fixed0(material.amount)}`);

    options?.setPrice?.(group, material.ticker);
  }
}

/**
 * Sets the deadline (days to fulfill) input.
 */
export function setDeadline(ctx: ActionStepExecuteContext<unknown>, anchor: Element, days: number) {
  const assert: AssertFn = ctx.assert;
  const { log } = ctx;

  assert(
    Number.isInteger(days) && days >= minContractDays && days <= maxContractDays,
    `Deadline must be from ${minContractDays} to ${maxContractDays} days`,
  );

  const deadlineInput = anchor.querySelector<HTMLInputElement>('input[name="deadline"]');
  assert(deadlineInput, 'Could not find deadline input');
  selectAndChangeInputValue(deadlineInput, String(days));
  log.info(`Deadline set: ${fixed0(days)} days`);
}

/**
 * Clicks "Apply Template" and waits for the server to rewrite the draft's
 * conditions. The button's disabled class flickers on any re-render, so it is
 * not evidence that the template was accepted.
 */
export async function applyTemplate(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  draftId: string,
) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Applying template...');

  const applyBtn = await pollUntil(() => findButton(anchor, 'apply template'), 5000);
  assert(applyBtn, 'Could not find "Apply Template" button');
  assert(!applyBtn.classList.contains(C.Button.disabled), 'Template form is invalid');

  const before = contractDraftsStore.getByNaturalId(draftId);
  await clickElement(applyBtn);

  const applied = await pollUntil(() => {
    const draft = contractDraftsStore.getByNaturalId(draftId);
    return draft !== undefined && draft !== before && draft.conditions.length > 0;
  }, 8000);
  assert(applied, 'Template conditions were not received');
  log.info('Template applied');
}

/**
 * Clicks the conditions save button and waits for the draft to come back valid.
 */
export async function saveConditions(
  ctx: ActionStepExecuteContext<unknown>,
  anchor: Element,
  draftId: string,
) {
  const assert: AssertFn = ctx.assert;
  const { log, setStatus } = ctx;

  setStatus('Saving conditions...');

  const before = contractDraftsStore.getByNaturalId(draftId);
  const condSaveBtn = _$$(anchor, C.Button.btn).findLast(hasText('save'));
  assert(
    condSaveBtn !== undefined && !condSaveBtn.classList.contains(C.Button.disabled),
    'Conditions save button is missing or disabled',
  );
  await clickElement(condSaveBtn);

  const saved = await pollUntil(() => {
    const draft = contractDraftsStore.getByNaturalId(draftId);
    return (
      draft !== undefined &&
      draft !== before &&
      draft.status === 'VALID' &&
      draft.conditions.length > 0
    );
  }, 8000);
  assert(saved, 'Contract conditions were not saved');
  log.info('Conditions saved');
}
