import { describe, expect, it } from 'vitest';
import {
  autoSfcPlanetRaw,
  initialPlanetAutoSfc,
  rememberPlanetAutoSfc,
  savedPlanetAutoSfc,
  shouldEmitAutoSfc,
  shouldShowAutoSfcToggle,
} from './auto-sfc';

describe('shouldShowAutoSfcToggle', () => {
  it('shows the toggle on BURNACT, REPAIRACT, and GOVBURNEXEC', () => {
    expect(shouldShowAutoSfcToggle('BURNACT')).toBe(true);
    expect(shouldShowAutoSfcToggle('REPAIRACT')).toBe(true);
    expect(shouldShowAutoSfcToggle('GOVBURNEXEC')).toBe(true);
  });

  it('does not show the toggle on DISPATCHACT or generic ACT', () => {
    expect(shouldShowAutoSfcToggle('DISPATCHACT')).toBe(false);
    expect(shouldShowAutoSfcToggle('ACT')).toBe(false);
    expect(shouldShowAutoSfcToggle('GOVBURNACT')).toBe(false);
    expect(shouldShowAutoSfcToggle('REFUELACT')).toBe(false);
  });
});

describe('savedPlanetAutoSfc', () => {
  it('returns a stored off for that planet', () => {
    expect(savedPlanetAutoSfc({ 'OT-580b': false }, 'OT-580b')).toBe(false);
  });

  it('does not invent a choice for a planet that has never been set', () => {
    expect(savedPlanetAutoSfc({}, 'OT-580b')).toBeUndefined();
    expect(savedPlanetAutoSfc(undefined, 'OT-580b')).toBeUndefined();
    expect(savedPlanetAutoSfc({ 'OT-580b': false }, 'VH-331a')).toBeUndefined();
  });
});

describe('initialPlanetAutoSfc', () => {
  it('uses the remembered off when the base has one', () => {
    expect(initialPlanetAutoSfc({ 'OT-580b': false }, 'OT-580b')).toBe(false);
  });

  it('starts a base with no selection on', () => {
    expect(initialPlanetAutoSfc({}, 'OT-580b')).toBe(true);
    expect(initialPlanetAutoSfc(undefined, 'OT-580b')).toBe(true);
    expect(initialPlanetAutoSfc({ 'OT-580b': false }, 'VH-331a')).toBe(true);
    expect(initialPlanetAutoSfc({ 'OT-580b': false }, undefined)).toBe(true);
  });
});

describe('rememberPlanetAutoSfc', () => {
  it('stores off for that planet', () => {
    const map: Record<string, boolean> = {};
    rememberPlanetAutoSfc(map, 'OT-580b', false);
    expect(map['OT-580b']).toBe(false);
  });

  it('does not write an on — default on is absence of a key', () => {
    const map: Record<string, boolean> = {};
    rememberPlanetAutoSfc(map, 'OT-580b', true);
    expect(map['OT-580b']).toBeUndefined();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('clears a stored off when the base is turned back on', () => {
    const map: Record<string, boolean> = { 'OT-580b': false };
    rememberPlanetAutoSfc(map, 'OT-580b', true);
    expect(map['OT-580b']).toBeUndefined();
  });

  it('leaves another planet alone', () => {
    const map: Record<string, boolean> = { 'VH-331a': false };
    rememberPlanetAutoSfc(map, 'OT-580b', false);
    expect(map['VH-331a']).toBe(false);
    expect(map['OT-580b']).toBe(false);
  });
});

describe('shouldEmitAutoSfc', () => {
  it('emits when no prior choice exists', () => {
    expect(shouldEmitAutoSfc({}, undefined, 'Burn Resupply: Hortus')).toBe(true);
    expect(shouldEmitAutoSfc({}, {}, 'Burn Resupply: Hortus')).toBe(true);
    expect(shouldEmitAutoSfc({}, { autoSfc: true }, 'Burn Resupply: Hortus')).toBe(true);
  });

  it('does not emit when the per-base toggle is off', () => {
    expect(shouldEmitAutoSfc({}, { autoSfc: false }, 'Burn Resupply: Hortus')).toBe(false);
  });

  it('does not emit when noSfc is set', () => {
    expect(shouldEmitAutoSfc({ noSfc: true }, { autoSfc: true }, 'Burn Resupply: Hortus')).toBe(
      false,
    );
  });

  it('does not emit for PRUNplanner packages', () => {
    expect(shouldEmitAutoSfc({}, { autoSfc: true }, 'PRUNplanner Burn Supply')).toBe(false);
  });
});

describe('autoSfcPlanetRaw', () => {
  it('uses sfcDestination for GOVBURNEXEC', () => {
    expect(autoSfcPlanetRaw('GOVBURNEXEC', 'OT-580b', '')).toBe('OT-580b');
  });

  it('uses the XIT parameter for BURNACT when sfcDestination is unset', () => {
    expect(autoSfcPlanetRaw('BURNACT', undefined, 'OT-580b')).toBe('OT-580b');
  });

  it('does not resolve a planet on DISPATCHACT', () => {
    expect(autoSfcPlanetRaw('DISPATCHACT', 'OT-580b', 'OT-580b')).toBeUndefined();
  });
});
