import { afterEach, describe, expect, it } from 'vitest';
import { setActDispatchAutoCloseEnabled, shouldAutoCloseActBuffer } from './auto-close';

afterEach(() => {
  setActDispatchAutoCloseEnabled(false);
});

describe('shouldAutoCloseActBuffer', () => {
  it('closes on successful completion when enabled', () => {
    setActDispatchAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(true)).toBe(true);
  });

  it('does not close when the feature is disabled', () => {
    expect(shouldAutoCloseActBuffer(true)).toBe(false);
  });

  it('does not close on failed or canceled completion', () => {
    setActDispatchAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(false)).toBe(false);
  });

  it('does not close a run that kept its buffer open', () => {
    setActDispatchAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(true, true)).toBe(false);
  });
});
