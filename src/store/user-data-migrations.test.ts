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

const ADD_FLT_COLORS_ID = '26.09.2026 Add FLT button colors';
const RESTORE_FLT_COLORS_ID = '27.09.2026 Restore historic FLT unload colors';

function appliedExcept(ids: string[]) {
  const userData = structuredClone(initialUserData) as any;
  migrateUserData(userData);
  userData.migrations = userData.migrations.filter((x: string) => !ids.includes(x));
  return userData;
}

describe('FLT unload button color defaults', () => {
  it('writes historic blue/orange for an existing player who has not picked a color', () => {
    const userData = appliedExcept([ADD_FLT_COLORS_ID, RESTORE_FLT_COLORS_ID]);
    delete userData.settings.fltButtonColors;
    migrateUserData(userData);
    expect(userData.settings.fltButtonColors).toEqual({
      baseEmpty: '#43a4df',
      baseCargo: '#f7a600',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    });
  });

  it('restores blue/orange when the unreleased migration stored purple/red', () => {
    const userData = appliedExcept([RESTORE_FLT_COLORS_ID]);
    userData.settings.fltButtonColors = {
      baseEmpty: '#b48ad8',
      baseCargo: '#e8676b',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    };
    migrateUserData(userData);
    expect(userData.settings.fltButtonColors).toEqual({
      baseEmpty: '#43a4df',
      baseCargo: '#f7a600',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    });
  });

  it('leaves a color the player already chose', () => {
    const userData = appliedExcept([RESTORE_FLT_COLORS_ID]);
    userData.settings.fltButtonColors = {
      baseEmpty: '#2a9d8f',
      baseCargo: '#5cb85c',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    };
    migrateUserData(userData);
    expect(userData.settings.fltButtonColors.baseEmpty).toBe('#2a9d8f');
    expect(userData.settings.fltButtonColors.baseCargo).toBe('#5cb85c');
  });

  it('restores the automatic base pair even when the player edited a CX color', () => {
    const userData = appliedExcept([RESTORE_FLT_COLORS_ID]);
    userData.settings.fltButtonColors = {
      baseEmpty: '#b48ad8',
      baseCargo: '#e8676b',
      cxEmpty: '#2a9d8f',
      cxCargo: '#e8676b',
    };
    migrateUserData(userData);
    expect(userData.settings.fltButtonColors).toEqual({
      baseEmpty: '#43a4df',
      baseCargo: '#f7a600',
      cxEmpty: '#2a9d8f',
      cxCargo: '#e8676b',
    });
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
