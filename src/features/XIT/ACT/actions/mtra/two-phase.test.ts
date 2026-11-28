import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDispatchShipPackage } from '@src/features/XIT/ACT/actions/mtra/two-phase';

const here = dirname(fileURLToPath(import.meta.url));

describe('empty DISPATCH ship package', () => {
  it('sends an empty portion with an SFC-only action and no load group', () => {
    const pkg = buildDispatchShipPackage({
      loadName: 'Load Hauler',
      shipName: 'Hauler',
      origin: 'Antares Station Warehouse',
      dest: 'Hauler Cargo',
      sfcDestination: 'OT-580b',
      materials: {},
      offloadGroups: [],
      agentGroups: [],
      repairGroups: [],
      pickupGroups: [],
    });

    expect(pkg.loadGroup).toBeUndefined();
    expect(pkg.load).toBeUndefined();
    expect(pkg.finish).toEqual({
      type: 'MTRA',
      name: 'Send Hauler',
      origin: 'Antares Station Warehouse',
      dest: 'Hauler Cargo',
      sfcOnly: true,
      sfcDestination: 'OT-580b',
    });
    expect(pkg.finish.group).toBeUndefined();
    expect(pkg.finish.noSfc).toBeUndefined();

    const dispatch = readFileSync(join(here, '../../../DISPATCH/DISPATCH.vue'), 'utf8');
    expect(dispatch).toContain('buildDispatchShipPackage');
    expect(dispatch).toContain('if (shipPkg.loadGroup !== undefined)');
    expect(dispatch).not.toMatch(/groups\.push\(\{\s*type: 'Manual',\s*name: loadName/);

    const mtra = readFileSync(join(here, 'mtra.ts'), 'utf8');
    const sfcOnly = mtra.indexOf('data.sfcOnly === true');
    const groupLookup = mtra.indexOf('getMaterialGroup(data.group)');
    expect(sfcOnly).toBeGreaterThan(-1);
    expect(groupLookup).toBeGreaterThan(sfcOnly);
    expect(mtra.slice(sfcOnly, groupLookup)).toContain('return');
    expect(mtra.slice(sfcOnly, groupLookup)).toContain('OPEN_SFC({');
  });
});
