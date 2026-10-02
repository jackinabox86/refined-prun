/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { migrateUserData } from '@src/store/user-data-migrations';
import { initialUserData } from '@src/store/user-data';

const FORCE_CX_BUY_ID = '28.09.2026 Make govburn force CX buy per planet';

describe('govburn per-planet force CX buy migration', () => {
  it('creates an empty planet map without changing an existing resupply horizon', () => {
    const userData = appliedExcept([FORCE_CX_BUY_ID]);
    delete userData.govburn.config.planetForceCXBuy;
    userData.govburn.config.resupplyDays = 15;
    migrateUserData(userData);
    expect(userData.govburn.config.planetForceCXBuy).toEqual({});
    expect(userData.govburn.config.resupplyDays).toBe(15);
  });

  it('drops the unreleased global flag so no planet inherits it', () => {
    const userData = appliedExcept([FORCE_CX_BUY_ID]);
    delete userData.govburn.config.planetForceCXBuy;
    userData.govburn.config.forceCXBuy = true;
    migrateUserData(userData);
    expect(userData.govburn.config.forceCXBuy).toBeUndefined();
    expect(userData.govburn.config.planetForceCXBuy).toEqual({});
  });
});

const RENAME_ID = '20.09.2026 Rename act-dispatch-auto-close';
const DECIMAL_DAYS_ID = '29.09.2026 Add XIT BS decimal burn days';
const BURNACT_REFUEL_ID = '30.09.2026 Add BURNACT refuel option';

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

const REPAIR_SECTION_ID = '26.09.2026 Add repair section thresholds';
const REPAIR_OFFSET_ID = '27.09.2026 Remove repair time offset';

// User data as it looks before the repair section and offset removal migrations:
// an XIT REP age threshold, a time offset, and per-planet overrides for both.
function existingRepairUser(planetOverrides: any) {
  const userData = structuredClone(initialUserData) as any;
  migrateUserData(userData);
  userData.migrations = userData.migrations.filter(
    (x: string) => x !== REPAIR_SECTION_ID && x !== REPAIR_OFFSET_ID,
  );
  delete userData.settings.repair.red;
  delete userData.settings.repair.yellow;
  delete userData.settings.repair.countdown;
  userData.settings.repair.threshold = 42;
  userData.settings.repair.offset = 12;
  userData.settings.repair.planetOverrides = planetOverrides;
  userData.settings.noBuy = ['RAT'];
  userData.settings.noBuyAll = true;
  userData.settings.noBuyThresholds = { yellow: 11, red: 22 };
  return userData;
}

describe('repair section migration', () => {
  it('does not replace an existing repair target or no-buy list', () => {
    const userData = existingRepairUser({ 'OT-580b': { threshold: 30, offset: 4 } });
    migrateUserData(userData);
    expect(userData.settings.repair.threshold).toBe(42);
    expect(userData.settings.noBuy).toEqual(['RAT']);
    expect(userData.settings.noBuyAll).toBe(true);
    expect(userData.settings.noBuyThresholds).toEqual({ yellow: 11, red: 22 });
    expect(userData.settings.repair.red).toBe(3);
    expect(userData.settings.repair.yellow).toBe(7);
    expect(userData.settings.repair.countdown).toBe(false);
  });

  it('drops the time offset and keeps the per-planet target', () => {
    const userData = existingRepairUser({ 'OT-580b': { threshold: 30, offset: 4 } });
    migrateUserData(userData);
    expect(userData.settings.repair.offset).toBeUndefined();
    expect(userData.settings.repair.planetOverrides).toEqual({ 'OT-580b': { threshold: 30 } });
  });

  it('drops an override that held nothing but a time offset', () => {
    const userData = existingRepairUser({ 'OT-580b': { offset: 4 }, 'UV-351a': { threshold: 30 } });
    migrateUserData(userData);
    expect(userData.settings.repair.planetOverrides).toEqual({ 'UV-351a': { threshold: 30 } });
  });

  it('ships the repair section defaults for a fresh install', () => {
    expect(initialUserData.settings.repair.threshold).toBe(60);
    expect(initialUserData.settings.repair.red).toBe(3);
    expect(initialUserData.settings.repair.yellow).toBe(7);
    expect(initialUserData.settings.repair.countdown).toBe(false);
    expect(initialUserData.settings.noBuy).toEqual([]);
    expect('offset' in initialUserData.settings.repair).toBe(false);
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

describe('BURNACT refuel migration', () => {
  it('turns refuel on for an existing player without changing other burn settings', () => {
    const userData = appliedExcept([BURNACT_REFUEL_ID]);
    delete userData.settings.burn.refuel;
    userData.settings.burn.red = 4;
    migrateUserData(userData);
    expect(userData.settings.burn.refuel).toBe(true);
    expect(userData.settings.burn.red).toBe(4);
  });

  it('ships on for a fresh install', () => {
    expect(initialUserData.settings.burn.refuel).toBe(true);
  });
});

describe('XIT BS decimal burn days migration', () => {
  it('gives an existing player the off default without changing other burn settings', () => {
    const userData = appliedExcept([DECIMAL_DAYS_ID]);
    delete userData.settings.burn.decimalDays;
    userData.settings.burn.red = 4;
    migrateUserData(userData);
    expect(userData.settings.burn.decimalDays).toBe(false);
    expect(userData.settings.burn.red).toBe(4);
  });

  it('ships off for a fresh install', () => {
    expect(initialUserData.settings.burn.decimalDays).toBe(false);
  });
});
