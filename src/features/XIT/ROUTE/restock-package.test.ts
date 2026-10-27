import { describe, expect, it } from 'vitest';
import { restockPackage } from '@src/features/XIT/ROUTE/restock-package';

describe('restockPackage', () => {
  it('buys each exchange origin its own group, net of CX stock, skipping empty ones', () => {
    const pkg = restockPackage([
      { exchange: 'AI1', materials: { RAT: 40 } },
      { exchange: 'NC1', materials: {} },
      { exchange: 'CI1', materials: { DW: 5 } },
    ]);
    expect(pkg.groups).toEqual([
      { type: 'Manual', name: 'Restock AI1', materials: { RAT: 40 } },
      { type: 'Manual', name: 'Restock CI1', materials: { DW: 5 } },
    ]);
    expect(pkg.actions.map(x => [x.type, x.group, x.exchange, x.useCXInv])).toEqual([
      ['CX Buy', 'Restock AI1', 'AI1', true],
      ['CX Buy', 'Restock CI1', 'CI1', true],
    ]);
  });
});
