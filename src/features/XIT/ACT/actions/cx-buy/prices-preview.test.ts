import { describe, expect, it, vi } from 'vitest';
import {
  buildPreviewPurchase,
  formatPreviewPurchase,
  formatPreviewTotal,
  missingPriceTickers,
  priceExcessPercent,
  priceExcessTone,
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

describe('priceExcessTone', () => {
  it('shades yellow above 10 and red above 20', () => {
    expect(priceExcessTone(10)).toBe('none');
    expect(priceExcessTone(10.1)).toBe('yellow');
    expect(priceExcessTone(20)).toBe('yellow');
    expect(priceExcessTone(20.1)).toBe('red');
  });

  it('does not shade unknown excess', () => {
    expect(priceExcessTone(undefined)).toBe('none');
    expect(priceExcessPercent(10, 0)).toBeUndefined();
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
  it('uses order-book cost when the book covers the amount', () => {
    mockedFillAmount.mockReturnValue({ amount: 10, priceLimit: 12, cost: 120 });
    const purchase = buildPreviewPurchase(
      { ticker: 'RAT', amount: 10, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      10,
    );
    expect(purchase).toMatchObject({
      cost: 120,
      projectedCost: 0,
      unitPrice: 12,
      excessPercent: 20,
      tone: 'yellow',
      projected: false,
    });
  });

  it('projects leftover amount at the refined-PrUn price when depth is short', () => {
    mockedFillAmount.mockReturnValue({ amount: 4, priceLimit: 12, cost: 48 });
    const purchase = buildPreviewPurchase(
      { ticker: 'DW', amount: 10, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      10,
    );
    expect(purchase.projected).toBe(true);
    expect(purchase.projectedCost).toBe(60);
    expect(purchase.cost).toBe(108);
  });

  it('projects the whole amount when no book is loaded', () => {
    mockedFillAmount.mockReturnValue(undefined);
    const purchase = buildPreviewPurchase(
      { ticker: 'H2O', amount: 5, priceLimit: Infinity, allowUnfilled: false },
      'AI1',
      8,
    );
    expect(purchase.projected).toBe(true);
    expect(purchase.cost).toBe(40);
    expect(purchase.projectedCost).toBe(40);
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
        projected: false,
      },
      {
        ticker: 'B',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 5,
        tone: 'none',
        projected: false,
      },
      {
        ticker: 'C',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 40,
        tone: 'red',
        projected: false,
      },
      {
        ticker: 'D',
        amount: 1,
        cost: 1,
        projectedCost: 0,
        unitPrice: 1,
        excessPercent: 12,
        tone: 'yellow',
        projected: false,
      },
    ]);
    expect(ranked.map(x => x.ticker)).toEqual(['C', 'D', 'B', 'A']);
  });
});

describe('preview log formatting', () => {
  it('marks projected totals and shades overage text', () => {
    const purchases = rankPreviewPurchases([
      {
        ticker: 'C',
        amount: 2,
        cost: 40,
        projectedCost: 10,
        unitPrice: 20,
        excessPercent: 25,
        tone: 'red',
        projected: true,
      },
      {
        ticker: 'B',
        amount: 1,
        cost: 11,
        projectedCost: 0,
        unitPrice: 11,
        excessPercent: 10.5,
        tone: 'yellow',
        projected: false,
      },
    ]);
    expect(formatPreviewTotal(purchases)).toEqual([
      { text: 'Total cost ' },
      { text: '51', yellow: true },
      { text: ' (' },
      { text: '10 projected', yellow: true },
      { text: ')' },
    ]);
    const redLine = formatPreviewPurchase(purchases[0]);
    expect(redLine.some(part => part.red && part.text.includes('% over'))).toBe(true);
    expect(redLine.some(part => part.text.includes('projected'))).toBe(true);
    const yellowLine = formatPreviewPurchase(purchases[1]);
    expect(yellowLine.some(part => part.yellow && part.text.includes('% over'))).toBe(true);
    expect(yellowLine.some(part => part.red)).toBe(false);
  });
});
