import { afterEach, describe, expect, it } from 'vitest';
import { setActDispatchAutoCloseEnabled, shouldAutoCloseActBuffer } from './auto-close';

afterEach(() => {
  setActDispatchAutoCloseEnabled(false);
});

describe('shouldAutoCloseActBuffer', () => {
  it('closes ACT, ACTION, and DISPATCHACT on successful completion when enabled', () => {
    setActDispatchAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer('ACT', true)).toBe(true);
    expect(shouldAutoCloseActBuffer('act', true)).toBe(true);
    expect(shouldAutoCloseActBuffer('ACTION', true)).toBe(true);
    expect(shouldAutoCloseActBuffer('DISPATCHACT', true)).toBe(true);
  });

  it('does not close when the feature is disabled', () => {
    expect(shouldAutoCloseActBuffer('ACT', true)).toBe(false);
    expect(shouldAutoCloseActBuffer('DISPATCHACT', true)).toBe(false);
  });

  it('does not close on failed or canceled completion', () => {
    setActDispatchAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer('ACT', false)).toBe(false);
    expect(shouldAutoCloseActBuffer('DISPATCHACT', false)).toBe(false);
  });

  it('does not close BURNACT, REFUELACT, REPAIRACT, GOVBURNEXEC, or DISPATCH', () => {
    setActDispatchAutoCloseEnabled(true);
    for (const command of ['BURNACT', 'REFUELACT', 'REPAIRACT', 'GOVBURNEXEC', 'DISPATCH']) {
      expect(shouldAutoCloseActBuffer(command, true)).toBe(false);
    }
  });
});
