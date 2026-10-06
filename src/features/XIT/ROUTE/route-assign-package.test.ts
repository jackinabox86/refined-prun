import { describe, expect, it } from 'vitest';
import {
  assignPackageIsRestock,
  routeAssignPackage,
} from '@src/features/XIT/ROUTE/route-assign-package';

describe('routeAssignPackage', () => {
  it('buys the shortfall without counting it as a route restock', () => {
    const pkg = routeAssignPackage('AI1', { RAT: 6, DW: 0 });
    expect(assignPackageIsRestock(pkg)).toBe(false);
    expect(pkg.groups).toEqual([{ type: 'Manual', name: 'Route buy AI1', materials: { RAT: 6 } }]);
    expect(pkg.actions).toEqual([
      {
        type: 'CX Buy',
        name: 'CX Buy AI1',
        group: 'Route buy AI1',
        exchange: 'AI1',
        useCXInv: false,
      },
    ]);
  });

  it('has no buy when the store already covers the bill', () => {
    const pkg = routeAssignPackage('AI1', {});
    expect(pkg.actions).toEqual([]);
    expect(pkg.groups).toEqual([]);
  });

  it('does not buy for a base origin', () => {
    expect(routeAssignPackage(undefined, { RAT: 4 }).actions).toEqual([]);
  });
});
