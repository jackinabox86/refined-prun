import { LogPart } from '@src/features/XIT/ACT/runner/logger';
import { fillAmount } from '@src/features/XIT/ACT/actions/cx-buy/utils';
import { fixed0, fixed02 } from '@src/utils/format';

export const DEFAULT_YELLOW_PERCENT = 10;
export const DEFAULT_RED_PERCENT = 20;

export type PriceTone = 'none' | 'yellow' | 'red';

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
  tone: PriceTone;
  projected: boolean;
}

export function shouldEmitPricesPreview(enabled: boolean, buyCount: number) {
  return enabled && buyCount > 0;
}

export function priceExcessPercent(price: number, refinedValue: number): number | undefined {
  if (!isFinite(price) || !isFinite(refinedValue) || refinedValue <= 0 || price <= 0) {
    return undefined;
  }
  return ((price - refinedValue) / refinedValue) * 100;
}

export function priceExcessTone(
  excess: number | undefined,
  yellow = DEFAULT_YELLOW_PERCENT,
  red = DEFAULT_RED_PERCENT,
): PriceTone {
  if (excess === undefined) {
    return 'none';
  }
  if (excess > red) {
    return 'red';
  }
  if (excess > yellow) {
    return 'yellow';
  }
  return 'none';
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
  yellow = DEFAULT_YELLOW_PERCENT,
  red = DEFAULT_RED_PERCENT,
): PreviewPurchase {
  const filled = fillAmount(`${buy.ticker}.${exchange}`, buy.amount, buy.priceLimit);
  const filledAmount = filled?.amount ?? 0;
  const filledCost = filled?.cost ?? 0;
  const remaining = Math.max(0, buy.amount - filledAmount);
  let projectedCost = 0;
  if (remaining > 0) {
    if (buy.allowUnfilled && isFinite(buy.priceLimit)) {
      projectedCost = remaining * buy.priceLimit;
    } else if (refinedValue !== undefined && refinedValue > 0) {
      projectedCost = remaining * refinedValue;
    }
  }
  const amount = filledAmount + remaining;
  const cost = filledCost + projectedCost;
  const unitPrice = amount > 0 ? cost / amount : 0;
  const excessPercent = priceExcessPercent(unitPrice, refinedValue ?? 0);
  return {
    ticker: buy.ticker,
    amount,
    cost,
    projectedCost,
    unitPrice,
    excessPercent,
    tone: priceExcessTone(excessPercent, yellow, red),
    projected: remaining > 0,
  };
}

export function rankPreviewPurchases(purchases: PreviewPurchase[]) {
  return purchases
    .slice()
    .sort((a, b) => (b.excessPercent ?? -Infinity) - (a.excessPercent ?? -Infinity));
}

export function formatPreviewTotal(purchases: PreviewPurchase[]): LogPart[] {
  let total = 0;
  let projectedTotal = 0;
  for (const purchase of purchases) {
    total += purchase.cost;
    projectedTotal += purchase.projectedCost;
  }
  const parts: LogPart[] = [{ text: 'Total cost ' }, { text: fixed0(total), yellow: true }];
  if (projectedTotal > 0) {
    parts.push(
      { text: ' (' },
      { text: `${fixed0(projectedTotal)} projected`, yellow: true },
      { text: ')' },
    );
  }
  return parts;
}

export function formatPreviewPurchase(purchase: PreviewPurchase): LogPart[] {
  const parts: LogPart[] = [
    {
      text: `${purchase.ticker} ${fixed0(purchase.amount)} @ ${fixed02(purchase.unitPrice)}`,
    },
  ];
  if (purchase.projected) {
    parts.push({ text: ' projected' });
  }
  parts.push({ text: ` (${fixed0(purchase.cost)})` });
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
