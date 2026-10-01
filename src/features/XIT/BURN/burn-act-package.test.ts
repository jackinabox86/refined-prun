import { describe, expect, it } from 'vitest';
import { allExchangesValue } from '@src/features/XIT/ACT/actions/refuel/utils';
import { burnActPackage } from './burn-act-package';

const hortus = { planetName: 'Hortus', naturalId: 'OT-580b', agent: false };

describe('burnActPackage', () => {
  it('prepends the all-exchanges refuel action when the toggle is on', () => {
    const pkg = burnActPackage({ ...hortus, refuel: true });
    expect(pkg.actions[0]).toEqual({
      type: 'Refuel',
      name: 'Refuel',
      origin: allExchangesValue,
      buyMissingFuel: true,
    });
    expect(pkg.actions.map(x => x.type)).toEqual(['Refuel', 'CX Buy', 'MTRA']);
  });

  it('does not include a Refuel action when the toggle is off', () => {
    const pkg = burnActPackage({ ...hortus, refuel: false });
    expect(pkg.actions.some(x => x.type === 'Refuel')).toBe(false);
    expect(pkg.actions.map(x => x.type)).toEqual(['CX Buy', 'MTRA']);
  });

  it('keeps the resupply group and the agent flag independent of refuel', () => {
    const pkg = burnActPackage({ ...hortus, refuel: false, agent: true });
    expect(pkg.global.name).toBe('Burn Resupply: Hortus');
    expect(pkg.groups).toEqual([
      {
        type: 'Resupply',
        name: 'Resupply',
        planet: 'Hortus',
        days: 'Configure on Execution',
        useBaseInv: true,
      },
    ]);
    const mtra = pkg.actions.find(x => x.type === 'MTRA');
    expect(mtra?.postToAgent).toBe(true);
  });
});
