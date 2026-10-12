import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/infrastructure/prun-api/data/addresses', () => ({
  getAddressName: (address?: { id?: string }) => address?.id ?? '',
}));

import { compareConditions } from './compare-conditions';

function condition(
  partial: Partial<PrunApi.ContractCondition> & Pick<PrunApi.ContractCondition, 'id'>,
): PrunApi.ContractCondition {
  return {
    type: 'DELIVERY',
    party: 'CUSTOMER',
    index: 0,
    status: 'PENDING',
    dependencies: [],
    deadlineDuration: null,
    deadline: null,
    ...partial,
  };
}

// Same key as calculateDeadline in contract-conditions.ts when there is no duration:
// a present deadline sorts by timestamp, and no deadline is infinity.
function balanceDeadline(item: PrunApi.ContractCondition) {
  if (item.deadline) {
    return item.deadline.timestamp;
  }
  return Number.POSITIVE_INFINITY;
}

describe('compareConditions', () => {
  it('matches the balance-sheet order when no deadline counts as infinity', () => {
    const rows = [
      condition({ id: 'none', type: 'PAYMENT' }),
      condition({ id: 'late', deadline: { timestamp: 20 } }),
      condition({ id: 'early', deadline: { timestamp: 10 } }),
    ];
    const byCompare = rows.toSorted((a, b) => compareConditions(a, b)).map(x => x.id);
    const byBalance = rows
      .toSorted((a, b) => balanceDeadline(a) - balanceDeadline(b))
      .map(x => x.id);
    expect(byCompare).toEqual(byBalance);
    expect(byCompare).toEqual(['early', 'late', 'none']);
  });

  it('breaks a missing-deadline tie by type, address, destination, ticker, then amount', () => {
    const later = condition({
      id: 'later',
      type: 'PAYMENT',
      address: { id: 'zeta' } as unknown as PrunApi.Address,
      destination: { id: 'zeta' } as unknown as PrunApi.Address,
      quantity: {
        material: { ticker: 'ZW' } as PrunApi.Material,
        amount: 5,
      },
    });
    const earlier = condition({
      id: 'earlier',
      type: 'DELIVERY',
      address: { id: 'alpha' } as unknown as PrunApi.Address,
      destination: { id: 'alpha' } as unknown as PrunApi.Address,
      quantity: {
        material: { ticker: 'AA' } as PrunApi.Material,
        amount: 1,
      },
    });
    expect(compareConditions(later, earlier)).toBeGreaterThan(0);

    const sameType = condition({
      ...earlier,
      id: 'same-type',
      type: 'PAYMENT',
    });
    expect(compareConditions(later, sameType)).toBeGreaterThan(0);

    const sameAddress = condition({
      ...sameType,
      id: 'same-address',
      address: later.address,
    });
    expect(compareConditions(later, sameAddress)).toBeGreaterThan(0);

    const sameDestination = condition({
      ...sameAddress,
      id: 'same-destination',
      destination: later.destination,
    });
    expect(compareConditions(later, sameDestination)).toBeGreaterThan(0);

    const sameTicker = condition({
      ...sameDestination,
      id: 'same-ticker',
      quantity: {
        material: { ticker: 'ZW' } as PrunApi.Material,
        amount: 1,
      },
    });
    expect(compareConditions(later, sameTicker)).toBeGreaterThan(0);
    expect(compareConditions(sameTicker, later)).toBeLessThan(0);
  });
});
