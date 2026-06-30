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
  console.log('[contd-fill] onTileReady called');

  subscribe($$(tile.anchor, C.TemplateSelection.group), async group => {
    const groups = _$$(tile.anchor, C.TemplateSelection.group);
    console.log('[contd-fill] group appeared, total groups:', groups.length, 'is first:', groups[0] === group);

    if (groups[0] !== group) return;

    // Log all label texts in this group so we can see what's actually there.
    setTimeout(() => {
      const labels = _$$(group, 'label');
      console.log('[contd-fill] labels in first group after 500ms:', labels.map(l => JSON.stringify(l.textContent?.trim())));
      console.log('[contd-fill] first group innerHTML preview:', group.innerHTML.slice(0, 500));
    }, 500);

    subscribe($$(group, 'label'), label => {
      const labelText = label.textContent?.trim().toLowerCase();
      console.log('[contd-fill] label found:', JSON.stringify(label.textContent?.trim()), '→ parentElement tag:', label.parentElement?.tagName, 'class:', label.parentElement?.className?.slice(0, 60));

      if (labelText !== 'price per unit' && labelText !== 'amount') return;

      const container = label.parentElement;
      if (!container) return;

      const inputWrapper = _$(container, C.FormComponent.input);
      console.log('[contd-fill] inputWrapper for', labelText, ':', inputWrapper?.className?.slice(0, 60) ?? 'NOT FOUND');
      if (!inputWrapper) return;

      const allBtn = document.createElement('button');
      allBtn.textContent = 'all';
      allBtn.type = 'button';
      allBtn.className = getAddBtnClass(tile);
      allBtn.addEventListener('click', () => fillAllGroups(tile, labelText));

      // Place the button to the left of the input content.
      const insertBefore =
        _$(inputWrapper, C.DynamicInput.dynamic) ?? inputWrapper.firstElementChild;
      if (insertBefore) insertBefore.before(allBtn);
      else inputWrapper.prepend(allBtn);
      console.log('[contd-fill] button added for', labelText);
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
