import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MAX_SHIPS_PER_BASE,
  allocateDispatchBills,
  assignDroppedShip,
  assignedShipIds,
  fitDaysInBudgets,
  removeAssignedShip,
  splitBillAcrossShips,
} from './two-ships';

const here = dirname(fileURLToPath(import.meta.url));

const sizeOf = (ticker: string) => {
  if (ticker === 'RAT') {
    return { weight: 1, volume: 1 };
  }
  if (ticker === 'H2O') {
    return { weight: 2, volume: 1 };
  }
  return { weight: 1, volume: 1 };
};

describe('assignDroppedShip', () => {
  it('appends a second ship in drop order', () => {
    expect(assignDroppedShip(['s1'], 's2')).toEqual(['s1', 's2']);
  });

  it('does not append a third ship', () => {
    expect(assignDroppedShip(['s1', 's2'], 's3')).toEqual(['s1', 's2']);
    expect(MAX_SHIPS_PER_BASE).toBe(2);
  });

  it('does not duplicate a ship already on the base', () => {
    expect(assignDroppedShip(['s1'], 's1')).toEqual(['s1']);
  });
});

describe('removeAssignedShip', () => {
  it('removes only the named ship', () => {
    expect(removeAssignedShip(['s1', 's2'], 's1')).toEqual(['s2']);
    expect(removeAssignedShip(['s1', 's2'], 's2')).toEqual(['s1']);
  });
});

describe('assignedShipIds', () => {
  it('reads a legacy single ship', () => {
    expect(assignedShipIds({ ship: 's1' })).toEqual(['s1']);
  });

  it('prefers the ships array over a stale ship field', () => {
    expect(assignedShipIds({ ships: ['s2'], ship: 's1' })).toEqual(['s2']);
  });
});

describe('splitBillAcrossShips', () => {
  const budgets = [
    { freeWeight: 10, freeVolume: 100 },
    { freeWeight: 10, freeVolume: 100 },
  ];

  it('fills the first ship before spilling', () => {
    const split = splitBillAcrossShips({ RAT: 15 }, budgets, sizeOf);
    expect(split.portions[0]).toEqual({ RAT: 10 });
    expect(split.portions[1]).toEqual({ RAT: 5 });
    expect(split.leftover).toEqual({});
  });

  it('does not spill while the first ship still has room', () => {
    const split = splitBillAcrossShips({ RAT: 6, H2O: 2 }, budgets, sizeOf);
    expect(split.portions[1]).toEqual({});
    expect(measure(split.portions[0]!)).toEqual({ weight: 10, volume: 8 });
  });

  it('leaves what fits in neither ship', () => {
    const split = splitBillAcrossShips({ RAT: 25 }, budgets, sizeOf);
    expect(split.leftover).toEqual({ RAT: 5 });
  });
});

describe('allocateDispatchBills', () => {
  it('keeps an empty second ship in the plan so it can still be sent', () => {
    const allocation = allocateDispatchBills(
      [{ naturalId: 'A', shipIds: ['s1', 's2'], bill: { RAT: 4 } }],
      new Map([
        ['s1', { freeWeight: 10, freeVolume: 100 }],
        ['s2', { freeWeight: 10, freeVolume: 100 }],
      ]),
      sizeOf,
    );
    expect(allocation.portions.get('A')?.get('s1')).toEqual({ RAT: 4 });
    expect(allocation.portions.get('A')?.get('s2')).toEqual({});
  });

  it('gives an earlier one-ship base its claim before a later spill', () => {
    const allocation = allocateDispatchBills(
      [
        { naturalId: 'A', shipIds: ['s1'], bill: { RAT: 8 } },
        { naturalId: 'B', shipIds: ['s1', 's2'], bill: { RAT: 6 } },
      ],
      new Map([
        ['s1', { freeWeight: 10, freeVolume: 100 }],
        ['s2', { freeWeight: 10, freeVolume: 100 }],
      ]),
      sizeOf,
    );
    expect(allocation.portions.get('A')?.get('s1')).toEqual({ RAT: 8 });
    expect(allocation.portions.get('B')?.get('s1')).toEqual({ RAT: 2 });
    expect(allocation.portions.get('B')?.get('s2')).toEqual({ RAT: 4 });
  });
});

describe('fitDaysInBudgets', () => {
  it('uses both holds combined', () => {
    const days = fitDaysInBudgets(
      [
        { freeWeight: 10, freeVolume: 100 },
        { freeWeight: 10, freeVolume: 100 },
      ],
      days => ({ RAT: days * 10 }),
      sizeOf,
    );
    expect(days).toBe(2);
  });

  it('returns undefined when the bill cannot be built', () => {
    expect(
      fitDaysInBudgets([{ freeWeight: 10, freeVolume: 10 }], () => undefined, sizeOf),
    ).toBeUndefined();
  });
});

describe('assign cell width', () => {
  const row = readFileSync(join(here, 'PlanetRow.vue'), 'utf8');

  it('does not widen the ship drop cell', () => {
    expect(row).toContain(
      '.shipPlaceholder {\n  border: 1px dashed #444;\n  height: 18px;\n  width: 84px;',
    );
    expect(row).toContain(
      '.shipAssigned {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  width: 84px;',
    );
    expect(row).not.toMatch(/\.shipAssigned \{[^}]*width:\s*(?!84px)\d+px/);
    expect(row).toContain('clearShip(ship.id)');
    expect(row).toContain('assignDroppedShip');
  });
});

function measure(bill: Record<string, number>) {
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(bill)) {
    const size = sizeOf(ticker)!;
    weight += size.weight * amount;
    volume += size.volume * amount;
  }
  return { weight, volume };
}
