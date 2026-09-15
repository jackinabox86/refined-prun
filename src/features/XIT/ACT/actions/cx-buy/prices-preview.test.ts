import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPreviewPurchase,
  formatPreviewPurchase,
  formatPreviewTotal,
  missingPriceTickers,
  rankPreviewPurchases,
  shouldEmitPricesPreview,
} from '@src/features/XIT/ACT/actions/cx-buy/prices-preview';

vi.mock('@src/features/XIT/ACT/actions/cx-buy/utils', () => ({
  fillAmount: vi.fn(),
}));

vi.mock('@src/utils/format', () => ({
  fixed0: (value: number) => String(Math.round(value)),
  fixed02: (value: number) => value.toFixed(2),
}));

import { fillAmount } from '@src/features/XIT/ACT/actions/cx-buy/utils';

const mockedFillAmount = vi.mocked(fillAmount);
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'prices-preview.ts'), 'utf8');

describe('shouldEmitPricesPreview', () => {
  it('emits only when the toggle is on and there is at least one buy', () => {
    expect(shouldEmitPricesPreview(true, 1)).toBe(true);
    expect(shouldEmitPricesPreview(true, 3)).toBe(true);
  });

  it('does not emit when the toggle is off', () => {
    expect(shouldEmitPricesPreview(false, 1)).toBe(false);
    expect(shouldEmitPricesPreview(false, 8)).toBe(false);
  });

  it('does not emit when there are no buys', () => {
    expect(shouldEmitPricesPreview(true, 0)).toBe(false);
    expect(shouldEmitPricesPreview(false, 0)).toBe(false);
  });
});

describe('prices-preview uses JAC-38 threshold helpers', () => {
  it('imports price-threshold helpers and does not keep a local copy', () => {
    expect(source).toContain("from '@src/features/XIT/ACT/actions/cx-buy/price-threshold'");
    expect(source).toContain('resolveCxBuyPrice');
    expect(source).toContain('priceExcessLevel');
    expect(source).not.toContain('export function priceExcessPercent');
    expect(source).not.toContain('DEFAULT_YELLOW_PERCENT');
    expect(source).not.toContain('DEFAULT_RED_PERCENT');
  });

  it('does not price unfillable units at the refined-PrUn value', () => {
    expect(source).not.toContain('remaining * refinedValue');
  });
});

describe('missingPriceTickers', () => {
  it('keeps only tickers whose CX book is missing', () => {
    const books = new Set(['RAT.AI1']);
    expect(
      missingPriceTickers(
        [
          { ticker: 'RAT', amount: 1, priceLimit: Infinity, allowUnfilled: false },
          { ticker: 'DW', amount: 2, priceLimit: Infinity, allowUnfilled: false },
        ],
        'AI1',
        cxTicker => books.has(cxTicker),
      ),
    ).toEqual(['DW']);
  });
});

describe('buildPreviewPurchase', () => {
  it('uses order-book cost and shades from the marginal fill, not the average', () => {
    mockedFillAmount.mockReturnValue({ amount: 10, priceLimit: 15, cost: 120 });
    const purchase = buildPreviewPurchase(
      { ticker: 'RAT', amount: 10, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      10,
      10,
      20,
    );
    expect(purchase).toMatchObject({
      cost: 120,
      projectedCost: 0,
      unitPrice: 12,
      shortfall: 0,
      excessPercent: 50,
      tone: 'red',
    });
  });

  it('does not cost leftover amount when the book is short', () => {
    mockedFillAmount.mockReturnValue({ amount: 4, priceLimit: 12, cost: 48 });
    const purchase = buildPreviewPurchase(
      { ticker: 'DW', amount: 10, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      10,
      10,
      20,
    );
    expect(purchase.cost).toBe(48);
    expect(purchase.projectedCost).toBe(0);
    expect(purchase.shortfall).toBe(6);
    expect(purchase.amount).toBe(4);
  });

  it('does not cost the whole amount when no book is loaded', () => {
    mockedFillAmount.mockReturnValue(undefined);
    const purchase = buildPreviewPurchase(
      { ticker: 'H2O', amount: 5, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      8,
      10,
      20,
    );
    expect(purchase.cost).toBe(0);
    expect(purchase.projectedCost).toBe(0);
    expect(purchase.shortfall).toBe(5);
    expect(purchase.excessPercent).toBeUndefined();
    expect(purchase.tone).toBe('none');
  });

  it('costs an allowUnfilled remainder at the player price limit', () => {
    mockedFillAmount.mockReturnValue({ amount: 2, priceLimit: 11, cost: 22 });
    const purchase = buildPreviewPurchase(
      { ticker: 'RAT', amount: 5, priceLimit: 20, allowUnfilled: true },
      'AI1',
      10,
      10,
      20,
    );
    expect(purchase.shortfall).toBe(0);
    expect(purchase.projectedCost).toBe(60);
    expect(purchase.cost).toBe(82);
    expect(purchase.amount).toBe(5);
    expect(purchase.excessPercent).toBe(100);
    expect(purchase.tone).toBe('red');
  });
});

describe('rankPreviewPurchases', () => {
  it('ranks purchases by percent over refined-PrUn price, unknowns last', () => {
    const ranked = rankPreviewPurchases([
      {
        ticker: 'A',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        tone: 'none',
        shortfall: 0,
      },
      {
        ticker: 'B',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 5,
        tone: 'none',
        shortfall: 0,
      },
      {
        ticker: 'C',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 40,
        tone: 'red',
        shortfall: 0,
      },
      {
        ticker: 'D',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 12,
        tone: 'yellow',
        shortfall: 0,
      },
    ]);
    expect(ranked.map(x => x.ticker)).toEqual(['C', 'D', 'B', 'A']);
  });
});

describe('preview log formatting', () => {
  it('marks unavailable depth and shades overage text', () => {
    const purchases = rankPreviewPurchases([
      {
        ticker: 'C',
        amount: 2,
        cost: 40,
        projectedCost: 0,
        unitPrice: 20,
        excessPercent: 25,
        tone: 'red',
        shortfall: 3,
      },
      {
        ticker: 'B',
        amount: 1,
        cost: 11,
        projectedCost: 0,
        unitPrice: 11,
        excessPercent: 10.5,
        tone: 'yellow',
        shortfall: 0,
      },
    ]);
    expect(formatPreviewTotal(purchases)).toEqual([
      { text: 'Total cost ' },
      { text: '51', yellow: true },
      { text: ' (' },
      { text: '3 unavailable', yellow: true },
      { text: ')' },
    ]);
    const redLine = formatPreviewPurchase(purchases[0]);
    expect(redLine.some(part => part.red && part.text.includes('% over'))).toBe(true);
    expect(redLine.some(part => part.text.includes('unavailable'))).toBe(true);
    const yellowLine = formatPreviewPurchase(purchases[1]);
    expect(yellowLine.some(part => part.yellow && part.text.includes('% over'))).toBe(true);
    expect(yellowLine.some(part => part.red)).toBe(false);
  });
});
