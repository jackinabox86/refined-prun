import { LogPart } from '@src/features/XIT/ACT/runner/logger';
import { fillAmount } from '@src/features/XIT/ACT/actions/cx-buy/utils';
import {
  priceExcessLevel,
  priceExcessPercent,
  resolveCxBuyPrice,
  type PriceThresholdLevel,
} from '@src/features/XIT/ACT/actions/cx-buy/price-threshold';
import { fixed0, fixed02 } from '@src/utils/format';

export interface PreviewBuy {
  ticker: string;
  amount: number;
  priceLimit: number;
  allowUnfilled: boolean;
}

export interface PreviewPurchase {
  ticker: string;
  amount: number;
  cost: number;
  projectedCost: number;
  unitPrice: number;
  excessPercent?: number;
  tone: PriceThresholdLevel;
  shortfall: number;
}

export function shouldEmitPricesPreview(enabled: boolean, buyCount: number) {
  return enabled && buyCount > 0;
}

export function missingPriceTickers(
  buys: PreviewBuy[],
  exchange: string,
  hasBook: (cxTicker: string) => boolean,
) {
  return buys.map(x => x.ticker).filter(ticker => !hasBook(`${ticker}.${exchange}`));
}

export function buildPreviewPurchase(
  buy: PreviewBuy,
  exchange: string,
  refinedValue: number | undefined,
  yellow: number,
  red: number,
): PreviewPurchase {
  const filled = fillAmount(`${buy.ticker}.${exchange}`, buy.amount, buy.priceLimit);
  const filledAmount = filled?.amount ?? 0;
  const filledCost = filled?.cost ?? 0;
  const remaining = Math.max(0, buy.amount - filledAmount);
  let projectedCost = 0;
  let shortfall = remaining;
  if (remaining > 0 && buy.allowUnfilled && isFinite(buy.priceLimit)) {
    // Standing bid at the player's own limit — not a market price the book lacks.
    projectedCost = remaining * buy.priceLimit;
    shortfall = 0;
  }
  const amount = filledAmount + (projectedCost > 0 ? remaining : 0);
  const cost = filledCost + projectedCost;
  const unitPrice = amount > 0 ? cost / amount : 0;
  const comparePrice = resolveCxBuyPrice({
    allowUnfilled: buy.allowUnfilled,
    priceLimit: buy.priceLimit,
    filled,
  });
  const excessPercent =
    comparePrice === undefined || refinedValue === undefined
      ? undefined
      : priceExcessPercent(comparePrice, refinedValue);
  return {
    ticker: buy.ticker,
    amount,
    cost,
    projectedCost,
    unitPrice,
    excessPercent,
    tone: priceExcessLevel(comparePrice, refinedValue, yellow, red),
    shortfall,
  };
}

export function rankPreviewPurchases(purchases: PreviewPurchase[]) {
  return purchases
    .slice()
    .sort((a, b) => (b.excessPercent ?? -Infinity) - (a.excessPercent ?? -Infinity));
}

export function formatPreviewTotal(purchases: PreviewPurchase[]): LogPart[] {
  let total = 0;
  let atLimit = 0;
  let shortfall = 0;
  for (const purchase of purchases) {
    total += purchase.cost;
    atLimit += purchase.projectedCost;
    shortfall += purchase.shortfall;
  }
  const parts: LogPart[] = [{ text: 'Total cost ' }, { text: fixed0(total), yellow: true }];
  if (atLimit > 0) {
    parts.push(
      { text: ' (' },
      { text: `${fixed0(atLimit)} at limit`, yellow: true },
      { text: ')' },
    );
  }
  if (shortfall > 0) {
    parts.push(
      { text: ' (' },
      { text: `${fixed0(shortfall)} unavailable`, yellow: true },
      { text: ')' },
    );
  }
  return parts;
}

export function formatPreviewPurchase(purchase: PreviewPurchase): LogPart[] {
  const parts: LogPart[] = [];
  if (purchase.amount > 0) {
    parts.push({
      text: `${purchase.ticker} ${fixed0(purchase.amount)} @ ${fixed02(purchase.unitPrice)}`,
    });
    if (purchase.projectedCost > 0) {
      parts.push({ text: ' at limit' });
    }
    parts.push({ text: ` (${fixed0(purchase.cost)})` });
  } else {
    parts.push({ text: `${purchase.ticker} ${fixed0(purchase.shortfall)} unavailable` });
    return parts;
  }
  if (purchase.shortfall > 0) {
    parts.push({ text: ` (${fixed0(purchase.shortfall)} unavailable)` });
  }
  if (purchase.excessPercent === undefined) {
    return parts;
  }
  parts.push({ text: ' ' });
  parts.push({
    text: `${fixed02(purchase.excessPercent)}% over`,
    yellow: purchase.tone === 'yellow',
    red: purchase.tone === 'red',
  });
  return parts;
}
