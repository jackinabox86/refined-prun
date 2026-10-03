import { describe, expect, it } from 'vitest';
import { setRouteBlock, type SetRouteGateInput } from '@src/features/XIT/ROUTE/set-route-gate';

function ready(patch: Partial<SetRouteGateInput> = {}): SetRouteGateInput {
  return {
    staging: true,
    shipChosen: true,
    stopCount: 2,
    billReady: true,
    legs: [{ ok: true }],
    supplyDays: 1,
    hasOverflow: false,
    inputOverloaded: false,
    ...patch,
  };
}

describe('setRouteBlock', () => {
  it('arms the button when transits, days, and loads all pass', () => {
    expect(setRouteBlock(ready())).toBeUndefined();
  });

  it('stays blocked until every recorded leg succeeded', () => {
    expect(setRouteBlock(ready({ legs: undefined }))).toBe('Run TRANSITS first.');
    expect(setRouteBlock(ready({ legs: [] }))).toBe('Run TRANSITS first.');
    expect(setRouteBlock(ready({ legs: [{ ok: true }, { ok: false }] }))).toBe(
      'Run TRANSITS first.',
    );
  });

  it('stays blocked until supply days is a positive finite number', () => {
    expect(setRouteBlock(ready({ supplyDays: 0 }))).toBe('Set supply days.');
    expect(setRouteBlock(ready({ supplyDays: Number.NaN }))).toBe('Set supply days.');
    expect(setRouteBlock(ready({ supplyDays: Number.POSITIVE_INFINITY }))).toBe('Set supply days.');
  });

  it('stays blocked while a stop is overloaded', () => {
    expect(setRouteBlock(ready({ hasOverflow: true }))).toBe('Fix the overloaded stops.');
    expect(setRouteBlock(ready({ inputOverloaded: true }))).toBe('Fix the overloaded stops.');
  });
});
