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
