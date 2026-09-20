import { afterEach, describe, expect, it } from 'vitest';
import { setActAutoCloseEnabled, shouldAutoCloseActBuffer } from './auto-close';

afterEach(() => {
  setActAutoCloseEnabled(false);
});

describe('shouldAutoCloseActBuffer', () => {
  it('closes on successful completion when enabled', () => {
    setActAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(true)).toBe(true);
  });

  it('does not close when the feature is disabled', () => {
    expect(shouldAutoCloseActBuffer(true)).toBe(false);
  });

  it('does not close on failed or canceled completion', () => {
    setActAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(false)).toBe(false);
  });

  it('does not close a run that kept its buffer open', () => {
    setActAutoCloseEnabled(true);
    expect(shouldAutoCloseActBuffer(true, true)).toBe(false);
  });
});
