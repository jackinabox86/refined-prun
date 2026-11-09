import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@src/infrastructure/prun-ui/prun-css', () => ({
  C: { Workforces: { daysMissing: 'red', daysWarning: 'yellow', daysSupplied: 'green' } },
}));
vi.mock('@src/core/burn', () => ({ getMinDaysLeft: () => 0 }));
vi.mock('@src/infrastructure/prun-api/data/materials', () => ({ materialsStore: {} }));
vi.mock('@src/core/sort-materials', () => ({ sortMaterials: () => [] }));
vi.mock('@src/utils/format', () => ({ trunc0: String, trunc01: String }));

import { applyInitialUserData, userData } from '@src/store/user-data';
import { burnDaysClass } from '@src/features/XIT/BURN/utils';

const here = dirname(fileURLToPath(import.meta.url));

function band(days: number) {
  return Object.entries(burnDaysClass(days))
    .filter(([, on]) => on)
    .map(([name]) => name);
}

describe('burnDaysClass', () => {
  beforeEach(() => {
    applyInitialUserData();
    userData.settings.burn.red = 3;
    userData.settings.burn.yellow = 7;
  });

  it('puts a fractional value just above a threshold in the better band', () => {
    expect(band(7.3)).toEqual(['green']);
    expect(band(3.3)).toEqual(['yellow']);
  });

  it('keeps a value exactly at a threshold in that threshold band', () => {
    expect(band(7)).toEqual(['yellow']);
    expect(band(3)).toEqual(['red']);
  });

  it('keeps values below a threshold in the worse band', () => {
    expect(band(6.9)).toEqual(['yellow']);
    expect(band(2.9)).toEqual(['red']);
  });
});

describe('XIT BS burn colour', () => {
  it('uses the same unfloored thresholds as XIT BURN', () => {
    const baseRow = readFileSync(join(here, '../BS/BaseRow.vue'), 'utf8');
    const burnBgClass = baseRow.match(/const burnBgClass = computed\([\s\S]*?\);\r?\n/)?.[0];
    expect(burnBgClass).toContain('burnDaysClass(days.value)');
    expect(burnBgClass).not.toContain('Math.floor');
  });
});
