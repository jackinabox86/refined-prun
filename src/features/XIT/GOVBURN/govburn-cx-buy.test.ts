import { describe, expect, it } from 'vitest';
import {
  govBurnUseCXInv,
  planetForceCXBuy,
  setPlanetForceCXBuy,
} from '@src/features/XIT/GOVBURN/govburn-cx-buy';

describe('planetForceCXBuy', () => {
  it('reads the toggle for that planet only', () => {
    const map = { 'KI-840c': true };
    expect(planetForceCXBuy(map, 'KI-840c')).toBe(true);
    expect(planetForceCXBuy(map, 'OT-580b')).toBe(false);
  });

  it('is off for a planet that was never toggled', () => {
    expect(planetForceCXBuy({}, 'KI-840c')).toBe(false);
    expect(planetForceCXBuy(undefined, 'KI-840c')).toBe(false);
    expect(planetForceCXBuy({ 'KI-840c': false }, 'KI-840c')).toBe(false);
  });

  it('is off when there is no planet to key on', () => {
    expect(planetForceCXBuy({ 'KI-840c': true }, undefined)).toBe(false);
    expect(planetForceCXBuy({ 'KI-840c': true }, '')).toBe(false);
  });
});

describe('setPlanetForceCXBuy', () => {
  it('turning one planet on leaves every other planet off', () => {
    const map: Record<string, boolean> = {};
    setPlanetForceCXBuy(map, 'KI-840c', true);
    expect(planetForceCXBuy(map, 'KI-840c')).toBe(true);
    expect(planetForceCXBuy(map, 'OT-580b')).toBe(false);
  });

  it('turning a planet off drops only that entry', () => {
    const map: Record<string, boolean> = { 'KI-840c': true, 'OT-580b': true };
    setPlanetForceCXBuy(map, 'KI-840c', false);
    expect(map).toEqual({ 'OT-580b': true });
  });

  it('stores off as an absent entry rather than false', () => {
    const map: Record<string, boolean> = {};
    setPlanetForceCXBuy(map, 'KI-840c', false);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe('govBurnUseCXInv', () => {
  it('keeps CX inventory when the force toggle is off or unset', () => {
    expect(govBurnUseCXInv(false)).toBe(true);
    expect(govBurnUseCXInv(undefined)).toBe(true);
  });

  it('skips CX inventory when the force toggle is on', () => {
    expect(govBurnUseCXInv(true)).toBe(false);
  });
});
