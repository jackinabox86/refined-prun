import { describe, expect, it } from 'vitest';
import { validBlueprintOptions } from '@src/features/XIT/ROUTE/blueprint-options';

function blueprint(naturalId: string, status: string, name: string | null) {
  return { naturalId, status, name } as PrunApi.Blueprint;
}

describe('validBlueprintOptions', () => {
  it('labels an unnamed blueprint by its natural id', () => {
    expect(validBlueprintOptions([blueprint('BP-OUKN-1482', 'VALID', null)])).toStrictEqual([
      { value: 'BP-OUKN-1482', label: 'BP-OUKN-1482' },
    ]);
  });

  it('still lists later blueprints after a VALID one with a null name', () => {
    expect(
      validBlueprintOptions([
        blueprint('BP-AAAA-0001', 'VALID', null),
        blueprint('BP-BBBB-0002', 'VALID', 'Standard 2k'),
      ]),
    ).toStrictEqual([
      { value: 'BP-AAAA-0001', label: 'BP-AAAA-0001' },
      { value: 'BP-BBBB-0002', label: 'Standard 2k (BP-BBBB-0002)' },
    ]);
  });

  it('keeps a name and drops non-VALID blueprints', () => {
    expect(
      validBlueprintOptions([
        blueprint('BP-AAAA-0001', 'LOCKED', 'Locked one'),
        blueprint('BP-BBBB-0002', 'VALID', 'Standard 2k'),
        blueprint('BP-CCCC-0003', 'VALID', '  '),
      ]),
    ).toStrictEqual([
      { value: 'BP-BBBB-0002', label: 'Standard 2k (BP-BBBB-0002)' },
      { value: 'BP-CCCC-0003', label: 'BP-CCCC-0003' },
    ]);
  });
});
