import { act } from '@src/features/XIT/ACT/act-registry';
import { changeSelectIndex } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { watchUntil } from '@src/utils/watch';
import { cxobStore } from '@src/infrastructure/prun-api/data/cxob';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { getCategoryById } from '@src/infrastructure/prun-api/data/material-categories';
import { getPrice } from '@src/infrastructure/fio/cx';
import { userData } from '@src/store/user-data';
import {
  buildPreviewPurchase,
  formatPreviewPurchase,
  formatPreviewTotal,
  missingPriceTickers,
  rankPreviewPurchases,
  type PreviewBuy,
} from '@src/features/XIT/ACT/actions/cx-buy/prices-preview';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';

const categoryLoadTimeoutMs = 10_000;

interface Data {
  exchange: string;
  group: string;
  buys: PreviewBuy[];
}

export const CX_PRICES_PREVIEW = act.addActionStep<Data>({
  type: 'CX_PRICES_PREVIEW',
  description: data => `Preview CX prices for ${data.group} on ${data.exchange}`,
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, complete } = ctx;
    const assert: AssertFn = ctx.assert;
    const { exchange, buys } = data;
    assert(exchange, 'Missing exchange');
    assert(buys.length > 0, 'No CX purchases to preview');

    const missing = missingPriceTickers(
      buys,
      exchange,
      cxTicker => cxobStore.getByTicker(cxTicker) !== undefined,
    );
    if (missing.length > 0) {
      // Companion tile, unexpanded CX listing. Opening does not cost an extra ACT
      // click: EXECUTE started the run, and the 2s review pause below is the gate.
      const tile = await requestTile(`CX ${exchange}`, { actGate: false });
      if (!tile) {
        return;
      }
      setStatus(`Loading CX ${exchange} category prices...`);
      await loadMissingCategoryPrices(tile, missing, exchange, log);
    }

    const thresholds = userData.settings.noBuyThresholds;
    const purchases = rankPreviewPurchases(
      buys.map(buy =>
        buildPreviewPurchase(
          buy,
          exchange,
          getPrice(buy.ticker),
          thresholds?.yellow ?? 10,
          thresholds?.red ?? 20,
        ),
      ),
    );
    log.info(formatPreviewTotal(purchases));
    for (const purchase of purchases) {
      log.info(formatPreviewPurchase(purchase));
    }

    await waitAct(`Review CX prices for ${data.group} on ${exchange}`, { actDelayMs: 2000 });
    complete();
  },
});

async function loadMissingCategoryPrices(
  tile: PrunTile,
  tickers: string[],
  exchange: string,
  log: { warning: (msg: string) => void },
) {
  // $() resolves only once the element exists. Race it: setStatus() above grayed ACT,
  // SKIP and CANCEL, so a CX tile that never renders its category selector would wedge
  // the run with no control left to the player.
  const select = (await Promise.race([$(tile.anchor, 'select'), sleep(categoryLoadTimeoutMs)])) as
    | HTMLSelectElement
    | undefined;
  if (select === undefined) {
    log.warning('CX category selector not found; using whatever prices are already loaded');
    return;
  }

  const byCategory = new Map<string, string[]>();
  for (const ticker of tickers) {
    if (cxobStore.getByTicker(`${ticker}.${exchange}`) !== undefined) {
      continue;
    }
    const material = materialsStore.getByTicker(ticker);
    const categoryId = material?.category;
    if (categoryId === undefined) {
      log.warning(`No material category for ${ticker}`);
      continue;
    }
    const list = byCategory.get(categoryId) ?? [];
    list.push(ticker);
    byCategory.set(categoryId, list);
  }

  for (const [categoryId, categoryTickers] of byCategory) {
    const index = indexOfCategory(select, categoryId);
    if (index < 0) {
      log.warning(`CX category for ${categoryTickers.join(', ')} not found on ${exchange}`);
      continue;
    }
    if (select.selectedIndex !== index) {
      changeSelectIndex(select, index);
    }
    await sleep(0);
    await waitForTickers(categoryTickers, exchange, categoryLoadTimeoutMs);
  }
}

function indexOfCategory(select: HTMLSelectElement, categoryId: string) {
  const options = Array.from(select.options);
  const byValue = options.findIndex(x => x.value === categoryId);
  if (byValue >= 0) {
    return byValue;
  }
  const category = getCategoryById(categoryId);
  const name = category?.name?.toUpperCase();
  if (name === undefined) {
    return -1;
  }
  return options.findIndex(x => x.textContent?.toUpperCase().includes(name));
}

async function waitForTickers(tickers: string[], exchange: string, timeoutMs: number) {
  await Promise.race([
    watchUntil(() =>
      tickers.every(ticker => cxobStore.getByTicker(`${ticker}.${exchange}`) !== undefined),
    ),
    sleep(timeoutMs),
  ]);
}
