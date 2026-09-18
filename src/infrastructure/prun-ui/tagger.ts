export enum ElementTag {
  FXPO_LOTS_FIELD = 'rp-fxpo-lots-field',
  FXPO_CURRENT_PRICE_FIELD = 'rp-fxpo-current-price-field',
  FXPO_MAXIMUM_PRICE_FIELD = 'rp-fxpo-maximum-price-field',
  FXPO_MINIMUM_PRICE_FIELD = 'rp-fxpo-minimum-price-field',
}

export function tagUI() {
  tagTileFormFields('FXPO', [
    [L.ForExPlaceOrderForm.label.lots(), ElementTag.FXPO_LOTS_FIELD],
    [L.ForExPlaceOrderForm.label.price(), ElementTag.FXPO_CURRENT_PRICE_FIELD],
    [L.ForExPlaceOrderForm.limit.maximum(), ElementTag.FXPO_MAXIMUM_PRICE_FIELD],
    [L.ForExPlaceOrderForm.limit.minimum(), ElementTag.FXPO_MINIMUM_PRICE_FIELD],
  ]);
}

function tagTileFormFields(command: string, mapItems: MapItems) {
  const tagMap = buildMap(mapItems);
  tiles.observe(command, tile => tagFormFields(tile.anchor, tagMap));
}

function tagFormFields(parent: Element, tagMap: Map<string, ElementTag>) {
  subscribe($$(parent, C.forms.formComponent), formComponent => {
    const label = _$(formComponent, 'label');
    if (!label) {
      return;
    }
    const textContent = _$(label, 'span')?.textContent;
    if (!textContent) {
      return;
    }
    const tag = tagMap.get(textContent);
    if (tag !== undefined) {
      formComponent.classList.add(tag);
    }
  });
}

type MapItems = [string | undefined, ElementTag][];

function buildMap(items: MapItems) {
  const map = new Map<string, ElementTag>();
  for (const [key, value] of items) {
    if (key !== undefined) {
      map.set(key, value);
    }
  }
  return map;
}
