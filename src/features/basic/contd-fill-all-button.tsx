import { changeInputValue, focusElement, selectMaterialInMaterialSelector } from '@src/util';
import PrunButton from '@src/components/PrunButton.vue';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { getMaterialByName } from '@src/infrastructure/prun-ui/i18n';
import $style from './contd-fill-all-button.module.css';

function onTileReady(tile: PrunTile) {
  let firstGroup: Element | undefined;

  subscribe($$(tile.anchor, C.TemplateSelection.group), group => {
    if (firstGroup !== undefined) {
      return;
    }
    firstGroup = group;

    const amountInput = group.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement | null;
    if (amountInput) {
      addAllButton(tile.anchor, amountInput, 'input[inputmode="numeric"]');
    }

    const priceInput = group.querySelector('input[inputmode="decimal"]') as HTMLInputElement | null;
    if (priceInput) {
      addAllButton(tile.anchor, priceInput, 'input[inputmode="decimal"]');
    }

    // The button goes before the selector's own input, not before the selector container:
    // the container is a block, so a button ahead of it would land on its own line.
    const materialInput = group.querySelector(
      `.${C.MaterialSelector.container} input`,
    ) as HTMLInputElement | null;
    if (materialInput) {
      addCommodityAllButton(tile.anchor, group, materialInput);
    }
  });
}

function addCommodityAllButton(anchor: Element, sourceGroup: Element, sourceInput: Element) {
  // Filling a selector is asynchronous, so a second click could otherwise race the first.
  let filling = false;
  const onClick = () => {
    if (filling) {
      return;
    }
    filling = true;
    void fillAllCommodity(anchor, sourceGroup).finally(() => {
      filling = false;
    });
  };
  createFragmentApp(() => (
    <PrunButton dark inline class={$style.allButton} onClick={onClick}>
      all
    </PrunButton>
  )).before(sourceInput);
}

function addAllButton(anchor: Element, sourceInput: HTMLInputElement, selector: string) {
  createFragmentApp(() => (
    <PrunButton
      dark
      inline
      class={$style.allButton}
      onClick={() => fillAll(anchor, sourceInput, selector)}>
      all
    </PrunButton>
  )).before(sourceInput);
}

function fillAll(anchor: Element, sourceInput: HTMLInputElement, selector: string) {
  const value = sourceInput.value;
  for (const group of _$$(anchor, C.TemplateSelection.group)) {
    const target = group.querySelector(selector) as HTMLInputElement | null;
    if (target && target !== sourceInput) {
      focusElement(target);
      changeInputValue(target, value);
    }
  }
}

async function fillAllCommodity(anchor: Element, sourceGroup: Element) {
  const sourceSelector = _$(sourceGroup, C.MaterialSelector.container);
  if (sourceSelector === undefined) {
    return;
  }
  const value = (_$(sourceSelector, 'input') as HTMLInputElement | undefined)?.value.trim();
  // After a pick the game rewrites the input to the i18n display name, not the ticker.
  const material = getMaterialByName(value) ?? materialsStore.getByTicker(value);
  if (material === undefined) {
    return;
  }
  const ticker = material.ticker;

  for (const group of _$$(anchor, C.TemplateSelection.group)) {
    if (group === sourceGroup) {
      continue;
    }
    const container = _$(group, C.MaterialSelector.container);
    if (container === undefined) {
      continue;
    }
    await selectMaterialInMaterialSelector(container, ticker);
  }
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds "all" buttons next to the first commodity/amount/price per unit fields to copy the value to every commodity section.',
);
