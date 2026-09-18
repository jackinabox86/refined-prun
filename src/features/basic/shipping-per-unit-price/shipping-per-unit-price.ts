import PpuLabel from './PpuLabel.vue';
import { refValue } from '@src/utils/reactive-dom';
import { fixed2 } from '@src/utils/format';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { localAdsStore } from '@src/infrastructure/prun-api/data/local-ads';

function onLMTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.CommodityAd.container), onAdContainerReady);
}

async function onAdContainerReady(container: HTMLElement) {
  const text = await $(container, C.CommodityAd.text);
  const id = getPrunId(container);
  const ad = localAdsStore.getById(id);
  if (!ad || ad.type !== 'COMMODITY_SHIPPING') {
    return;
  }

  const weight = ad.cargoWeight ?? 0;
  const volume = ad.cargoVolume ?? 0;
  if (weight === 0 && volume === 0) {
    return;
  }
  const unit = weight > volume ? 't' : 'm³';
  const amount = weight > volume ? weight : volume;
  const total = ad.price.amount;
  for (let i = 0; i < text.childNodes.length; i++) {
    const child = text.childNodes[i];
    if (child.nodeValue && child.nodeValue.includes(ad.price.currency)) {
      const span = document.createElement('span');
      span.textContent = ` (${fixed2(total / amount)}/${unit})`;
      child.after(span);
      break;
    }
  }
}

function onLMPTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.LocalMarketPost.form), onFormReady);
}

function onFormReady(form: HTMLElement) {
  const shippingType = L.LocalMarket.adType.shipping();
  const type = _$$(form, C.StaticInput.static);
  if (shippingType === undefined || !type.find(x => x.textContent === shippingType)) {
    return;
  }

  const commodityInput = labeledInput(form, L.LocalMarketPost.form.commodity());
  const amountInput = labeledInput(form, L.LocalMarketPost.form.amount());
  const totalPriceInput = labeledInput(form, L.LocalMarketPost.form.price());
  if (commodityInput === undefined || amountInput === undefined || totalPriceInput === undefined) {
    return;
  }

  createFragmentApp(
    PpuLabel,
    reactive({
      materialName: refValue(commodityInput),
      amountInput: refValue(amountInput),
      totalPriceInput: refValue(totalPriceInput),
    }),
  ).before(totalPriceInput.parentElement!);
}

function labeledInput(form: HTMLElement, label: string | undefined) {
  if (label === undefined) {
    return undefined;
  }
  for (const field of Array.from(form.querySelectorAll('div'))) {
    const span = field.querySelector(':scope > label > span');
    if (span?.textContent === label) {
      const input = field.querySelector('input');
      if (input instanceof HTMLInputElement) {
        return input;
      }
    }
  }
  return undefined;
}

function init() {
  tiles.observe(['LM', 'LMA'], onLMTileReady);
  tiles.observe('LMP', onLMPTileReady);
}

features.add(import.meta.url, init, 'Adds a per-unit price label to ads in LM, LMA, and LMP.');
