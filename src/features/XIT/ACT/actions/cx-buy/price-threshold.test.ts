import { describe, expect, it } from 'vitest';
import {
  priceExcessLevel,
  priceExcessPercent,
  priceWarningActDelayMs,
  resolveCxBuyPrice,
} from '@src/features/XIT/ACT/actions/cx-buy/price-threshold';

describe('priceExcessPercent', () => {
  it('returns the percent the price is above the refined-PrUn value', () => {
    expect(priceExcessPercent(110, 100)).toBeCloseTo(10);
    expect(priceExcessPercent(120, 100)).toBeCloseTo(20);
  });

  it('returns undefined when the refined-PrUn value cannot be a denominator', () => {
    expect(priceExcessPercent(110, 0)).toBeUndefined();
    expect(priceExcessPercent(110, -5)).toBeUndefined();
    expect(priceExcessPercent(110, Number.NaN)).toBeUndefined();
    expect(priceExcessPercent(Number.POSITIVE_INFINITY, 100)).toBeUndefined();
  });
});

describe('priceExcessLevel', () => {
  it('is none at or below either threshold', () => {
    expect(priceExcessLevel(110, 100, 10, 20)).toBe('none');
    expect(priceExcessLevel(109, 100, 10, 20)).toBe('none');
    expect(priceExcessLevel(100, 100, 10, 20)).toBe('none');
    expect(priceExcessLevel(90, 100, 10, 20)).toBe('none');
  });

  it('is yellow only when the excess is past yellow and not past red', () => {
    expect(priceExcessLevel(110.01, 100, 10, 20)).toBe('yellow');
    expect(priceExcessLevel(120, 100, 10, 20)).toBe('yellow');
  });

  it('is red when the excess is past the red threshold', () => {
    expect(priceExcessLevel(120.01, 100, 10, 20)).toBe('red');
  });

  it('is none when price or refined-PrUn value is missing', () => {
    expect(priceExcessLevel(undefined, 100, 10, 20)).toBe('none');
    expect(priceExcessLevel(110, undefined, 10, 20)).toBe('none');
    expect(priceExcessLevel(110, 0, 10, 20)).toBe('none');
  });
});

describe('priceWarningActDelayMs', () => {
  it('does not pause at or below threshold', () => {
    expect(priceWarningActDelayMs('none')).toBe(0);
  });

  it('forces a 2s pause past either threshold', () => {
    expect(priceWarningActDelayMs('yellow')).toBe(2000);
    expect(priceWarningActDelayMs('red')).toBe(2000);
  });
});

describe('resolveCxBuyPrice', () => {
  it('uses the bid limit for an unfilled order', () => {
    expect(
      resolveCxBuyPrice({
        allowUnfilled: true,
        priceLimit: 12.5,
        filled: { amount: 0, priceLimit: 0 },
      }),
    ).toBe(12.5);
  });

  it('uses the live fill price for a market buy', () => {
    expect(
      resolveCxBuyPrice({
        allowUnfilled: false,
        priceLimit: 99,
        filled: { amount: 10, priceLimit: 14.2 },
      }),
    ).toBe(14.2);
  });

  it('returns undefined when there is nothing to buy', () => {
    expect(resolveCxBuyPrice({ allowUnfilled: false, priceLimit: 99 })).toBeUndefined();
    expect(
      resolveCxBuyPrice({
        allowUnfilled: false,
        priceLimit: 99,
        filled: { amount: 0, priceLimit: 14.2 },
      }),
    ).toBeUndefined();
  });
});
