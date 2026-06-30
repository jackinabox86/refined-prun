import { changeInputValue } from '@src/util';

function getFieldInput(group: Element, fieldLabel: string): HTMLInputElement | undefined {
  for (const container of _$$(group, C.FormComponent.containerActive)) {
    const label = _$(container, 'label');
    if (label?.textContent?.trim().toLowerCase() !== fieldLabel) continue;
    const dynamic = _$(container, C.DynamicInput.dynamic);
    return dynamic?.querySelector('input') as HTMLInputElement | undefined;
  }
}

function fillAllGroups(tile: PrunTile, fieldLabel: string) {
  const groups = _$$(tile.anchor, C.TemplateSelection.group);
  if (groups.length < 2) return;
  const src = getFieldInput(groups[0], fieldLabel);
  if (!src) return;
  const value = src.value;
  for (let i = 1; i < groups.length; i++) {
    const dst = getFieldInput(groups[i], fieldLabel);
    if (dst) changeInputValue(dst, value);
  }
}

function getAddBtnClass(tile: PrunTile): string {
  const btn = _$$(tile.anchor, 'button').find(x => {
    const t = x.textContent?.trim().toLowerCase();
    return t === 'add commodity' || t === 'add shipment';
  });
  return (btn as HTMLButtonElement | undefined)?.className ?? C.Button.btn;
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.TemplateSelection.group), async group => {
    if (_$$(tile.anchor, C.TemplateSelection.group)[0] !== group) return;

    subscribe($$(group, C.FormComponent.containerActive), async container => {
      const label = await $(container, 'label');
      const labelText = label.textContent?.trim().toLowerCase();
      if (labelText !== 'price per unit' && labelText !== 'amount') return;

      const inputWrapper = _$(container, C.FormComponent.input);
      if (!inputWrapper) return;

      const allBtn = document.createElement('button');
      allBtn.textContent = 'all';
      allBtn.type = 'button';
      allBtn.className = getAddBtnClass(tile);
      allBtn.addEventListener('click', () => fillAllGroups(tile, labelText));

      const dynamicDiv = _$(inputWrapper, C.DynamicInput.dynamic);
      if (dynamicDiv) dynamicDiv.before(allBtn);
    });
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds "all" fill buttons to the price per unit and amount fields to copy values to all commodity sections.',
);
