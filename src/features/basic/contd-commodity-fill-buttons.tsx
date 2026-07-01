import { changeInputValue } from '@src/util';

function getFieldInput(group: Element, fieldLabel: string): HTMLInputElement | undefined {
  for (const label of _$$(group, 'label')) {
    if (label.textContent?.trim().toLowerCase() !== fieldLabel) continue;
    return label.parentElement?.querySelector('input') as HTMLInputElement | undefined;
  }
  return undefined;
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

    subscribe($$(group, 'label'), label => {
      const labelText = label.textContent?.trim().toLowerCase();
      if (labelText !== 'price per unit' && labelText !== 'amount') return;

      // The input wrapper is always the sibling after the label, regardless
      // of its CSS class hash (which is duplicated in this game context).
      const inputWrapper = label.nextElementSibling;
      if (!inputWrapper) return;

      const allBtn = document.createElement('button');
      allBtn.textContent = 'all';
      allBtn.type = 'button';
      allBtn.className = getAddBtnClass(tile);
      allBtn.style.marginLeft = 'auto';
      allBtn.addEventListener('click', () => fillAllGroups(tile, labelText));

      // containerActive is flex-row: inserting before the input wrapper
      // places the button to its left. margin-left:auto pushes it flush
      // against the input wrapper.
      inputWrapper.before(allBtn);
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
