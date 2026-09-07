import { describe, expect, it } from 'vitest';
import {
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
  windowStackIndex,
} from './mark-read-click';

describe('isNotificationMarkReadClick', () => {
  it('does not intercept a plain click', () => {
    expect(isNotificationMarkReadClick({ shiftKey: false, button: 0 })).toBe(false);
  });

  it('does not intercept a shift auxiliary click', () => {
    expect(isNotificationMarkReadClick({ shiftKey: true, button: 1 })).toBe(false);
  });

  it('intercepts a left shift-click', () => {
    expect(isNotificationMarkReadClick({ shiftKey: true, button: 0 })).toBe(true);
  });

  it('intercepts a shift-click when button is omitted', () => {
    expect(isNotificationMarkReadClick({ shiftKey: true })).toBe(true);
  });
});

describe('newlyOpenedWindows', () => {
  it('does not treat pre-existing windows as opened', () => {
    const existing = { id: 'existing' } as unknown as Element;
    const before = snapshotWindows([existing]);
    expect(newlyOpenedWindows(before, [existing])).toEqual([]);
  });

  it('returns only windows that appeared after the click', () => {
    const existing = { id: 'existing' } as unknown as Element;
    const opened = { id: 'opened' } as unknown as Element;
    const before = snapshotWindows([existing]);
    expect(newlyOpenedWindows(before, [existing, opened])).toEqual([opened]);
  });
});

describe('window stacking', () => {
  it('reads an explicit z-index and treats a missing one as 0', () => {
    expect(windowStackIndex({ style: { zIndex: '12' } })).toBe(12);
    expect(windowStackIndex({})).toBe(0);
  });

  it('picks the highest z-index window', () => {
    const back = { style: { zIndex: '1' } };
    const front = { style: { zIndex: '4' } };
    expect(topmostWindow([back, front])).toBe(front);
  });
});

describe('shouldRestorePriorWindow', () => {
  const prior = { id: 'prior' };
  const current = { id: 'current' };

  it('does not restore when the click created a new window', () => {
    expect(shouldRestorePriorWindow(1, prior, current)).toBe(false);
  });

  it('does not restore when focus did not change', () => {
    expect(shouldRestorePriorWindow(0, prior, prior)).toBe(false);
  });

  it('restores when an existing window stole focus and none opened', () => {
    expect(shouldRestorePriorWindow(0, prior, current)).toBe(true);
  });
});
