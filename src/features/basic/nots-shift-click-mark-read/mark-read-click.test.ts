import { describe, expect, it } from 'vitest';
import {
  closeOrUnhide,
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
  windowContainingClick,
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
  // Live C.Window.window nodes set inline z-index (2026-09-07): unfocused 1000/1001, focused 1002.
  it('reads the inline z-index PrUn sets on floating windows', () => {
    expect(windowStackIndex({ style: { zIndex: '1000' } })).toBe(1000);
    expect(windowStackIndex({ style: { zIndex: '1002' } })).toBe(1002);
    expect(windowStackIndex({})).toBe(0);
  });

  it('picks the highest z-index window, not document order', () => {
    const back = { style: { zIndex: '1002' } };
    const front = { style: { zIndex: '1001' } };
    // Live 2026-09-07: first in document order held the lower z-index.
    expect(topmostWindow([front, back])).toBe(back);
  });

  it('on a z-index tie, picks the last window in document order', () => {
    const first = { style: { zIndex: '1001' } };
    const last = { style: { zIndex: '1001' } };
    expect(topmostWindow([first, last])).toBe(last);
  });
});

describe('windowContainingClick', () => {
  it('returns the window that contains the click target', () => {
    const target = { id: 'row' };
    const other = { contains: () => false };
    const clicked = { contains: (node: unknown) => node === target };
    expect(windowContainingClick(target, [other, clicked])).toBe(clicked);
  });

  it('returns undefined when no window contains the target', () => {
    const target = { id: 'row' };
    expect(windowContainingClick(target, [{ contains: () => false }])).toBeUndefined();
    expect(windowContainingClick(null, [{ contains: () => true }])).toBeUndefined();
  });
});

describe('closeOrUnhide', () => {
  it('unhides when close throws', () => {
    const log: string[] = [];
    closeOrUnhide(
      () => {
        throw new Error('missing close control');
      },
      () => {
        log.push('unhide');
      },
    );
    expect(log).toEqual(['unhide']);
  });

  it('does not unhide when close succeeds', () => {
    const log: string[] = [];
    closeOrUnhide(
      () => {
        log.push('close');
      },
      () => {
        log.push('unhide');
      },
    );
    expect(log).toEqual(['close']);
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
