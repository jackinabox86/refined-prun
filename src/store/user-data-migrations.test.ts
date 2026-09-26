/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { migrateUserData } from '@src/store/user-data-migrations';
import { initialUserData } from '@src/store/user-data';

const RENAME_ID = '20.09.2026 Rename act-dispatch-auto-close';

// User data as it looks just before the rename migration: every other migration applied.
function beforeRename(disabled: string[]) {
  const userData = structuredClone(initialUserData) as any;
  migrateUserData(userData);
  userData.migrations = userData.migrations.filter((x: string) => x !== RENAME_ID);
  userData.settings.disabled = disabled;
  return userData;
}

const REPAIR_SECTION_ID = '26.09.2026 Add repair section thresholds';

function existingRepairUser() {
  const userData = structuredClone(initialUserData) as any;
  migrateUserData(userData);
  userData.migrations = userData.migrations.filter((x: string) => x !== REPAIR_SECTION_ID);
  delete userData.settings.repair.red;
  delete userData.settings.repair.yellow;
  delete userData.settings.repair.countdown;
  userData.settings.repair.threshold = 42;
  userData.settings.repair.offset = 12;
  userData.settings.repair.planetOverrides = { 'OT-580b': { threshold: 30, offset: 4 } };
  userData.settings.noBuy = ['RAT'];
  userData.settings.noBuyAll = true;
  userData.settings.noBuyThresholds = { yellow: 11, red: 22 };
  return userData;
}

describe('repair section migration', () => {
  it('does not replace an existing repair target or no-buy list', () => {
    const userData = existingRepairUser();
    migrateUserData(userData);
    expect(userData.settings.repair.threshold).toBe(42);
    expect(userData.settings.repair.offset).toBe(12);
    expect(userData.settings.repair.planetOverrides).toEqual({
      'OT-580b': { threshold: 30, offset: 4 },
    });
    expect(userData.settings.noBuy).toEqual(['RAT']);
    expect(userData.settings.noBuyAll).toBe(true);
    expect(userData.settings.noBuyThresholds).toEqual({ yellow: 11, red: 22 });
    expect(userData.settings.repair.red).toBe(3);
    expect(userData.settings.repair.yellow).toBe(7);
    expect(userData.settings.repair.countdown).toBe(false);
  });

  it('ships the repair section defaults for a fresh install', () => {
    expect(initialUserData.settings.repair.threshold).toBe(60);
    expect(initialUserData.settings.repair.red).toBe(3);
    expect(initialUserData.settings.repair.yellow).toBe(7);
    expect(initialUserData.settings.repair.countdown).toBe(false);
    expect(initialUserData.settings.noBuy).toEqual([]);
  });
});

describe('act-dispatch-auto-close rename', () => {
  it('keeps the feature off when it was off under the old id', () => {
    const userData = beforeRename(['oog-cxpo-quick-price', 'act-dispatch-auto-close']);
    migrateUserData(userData);
    expect(userData.settings.disabled).toContain('act-auto-close');
    expect(userData.settings.disabled).not.toContain('act-dispatch-auto-close');
    expect(userData.settings.disabled).toContain('oog-cxpo-quick-price');
  });

  it('keeps the feature on when the player had turned it on', () => {
    const userData = beforeRename(['oog-cxpo-quick-price']);
    migrateUserData(userData);
    expect(userData.settings.disabled).not.toContain('act-auto-close');
    expect(userData.settings.disabled).not.toContain('act-dispatch-auto-close');
  });

  it('ships the new id disabled by default for a fresh install', () => {
    expect(initialUserData.settings.disabled).toContain('act-auto-close');
    expect(initialUserData.settings.disabled).not.toContain('act-dispatch-auto-close');
  });
});
