import { describe, expect, it } from 'vitest';
import { cxpoInventoryLabel, cxpoSellHitsReserve } from '@src/features/basic/cxpo-route-stock';

describe('cxpoInventoryLabel', () => {
  it('splits the warehouse count into what routes hold and what is free', () => {
    // 12 on hand, 8 reserved: 4 are free. A label that skips the subtraction
    // would still say 12 free.
    expect(cxpoInventoryLabel(12, 8)).toBe('(8 Reserved) 4 Free');
  });

  it('shows zero free when the reserve is larger than the stock', () => {
    expect(cxpoInventoryLabel(3, 8)).toBe('(8 Reserved) 0 Free');
  });

  it('leaves the game number when this ticker has no reserve', () => {
    expect(cxpoInventoryLabel(12, undefined)).toBeUndefined();
    expect(cxpoInventoryLabel(12, 0)).toBeUndefined();
  });
});

describe('cxpoSellHitsReserve', () => {
  it('holds a sell that would leave less than the routes hold', () => {
    // 12 on hand, 8 reserved, selling 6 leaves 6, which is under the reserve.
    // Selling 4 leaves 8, which meets it.
    expect(cxpoSellHitsReserve(12, 6, 8)).toBe(true);
    expect(cxpoSellHitsReserve(12, 4, 8)).toBe(false);
  });

  it('lets the click through when nothing is reserved or the amount is empty', () => {
    expect(cxpoSellHitsReserve(12, 6, undefined)).toBe(false);
    expect(cxpoSellHitsReserve(12, 0, 8)).toBe(false);
  });

  it('holds any positive sell once the warehouse is already under the reserve', () => {
    expect(cxpoSellHitsReserve(5, 1, 8)).toBe(true);
  });
});
