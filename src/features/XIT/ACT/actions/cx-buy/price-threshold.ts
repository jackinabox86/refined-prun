export type PriceThresholdLevel = 'none' | 'yellow' | 'red';

export function priceExcessPercent(price: number, refinedValue: number): number | undefined {
  if (!isFinite(price) || !isFinite(refinedValue) || refinedValue <= 0 || price <= 0) {
    return undefined;
  }
  return ((price - refinedValue) / refinedValue) * 100;
}

export function priceExcessLevel(
  price: number | undefined,
  refinedValue: number | undefined,
  yellow: number,
  red: number,
): PriceThresholdLevel {
  if (price === undefined || refinedValue === undefined) {
    return 'none';
  }
  const excess = priceExcessPercent(price, refinedValue);
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

export function resolveCxBuyPrice(opts: {
  allowUnfilled: boolean;
  priceLimit: number;
  filled?: { amount: number; priceLimit: number };
}): number | undefined {
  if (opts.allowUnfilled) {
    return isFinite(opts.priceLimit) ? opts.priceLimit : undefined;
  }
  const filled = opts.filled;
  if (
    filled === undefined ||
    filled.amount <= 0 ||
    !isFinite(filled.priceLimit) ||
    filled.priceLimit <= 0
  ) {
    return undefined;
  }
  return filled.priceLimit;
}
