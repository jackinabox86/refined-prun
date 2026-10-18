import { describe, expect, it } from 'vitest';
import {
  closeOrUnhide,
  companionTarget,
  isCompanionHost,
  isNotificationCompanionClick,
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  openedWindowCommand,
  shouldAdoptOpenedWindowAsCompanion,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
  windowContainingClick,
  windowStackIndex,
} from './mark-read-click';

const plain = { shiftKey: false, ctrlKey: false, button: 0 };
const shift = { shiftKey: true, ctrlKey: false, button: 0 };
const ctrl = { shiftKey: false, ctrlKey: true, button: 0 };
const chord = { shiftKey: true, ctrlKey: true, button: 0 };

describe('isNotificationMarkReadClick', () => {
  it('does not intercept a plain click', () => {
    expect(isNotificationMarkReadClick(plain)).toBe(false);
  });

  it('does not intercept a shift-click', () => {
    expect(isNotificationMarkReadClick(shift)).toBe(false);
  });

  it('does not intercept a shift+ctrl click', () => {
    expect(isNotificationMarkReadClick(chord)).toBe(false);
  });

  it('does not intercept a ctrl auxiliary click', () => {
    expect(isNotificationMarkReadClick({ ctrlKey: true, button: 1 })).toBe(false);
  });

  it('intercepts a left ctrl-click', () => {
    expect(isNotificationMarkReadClick(ctrl)).toBe(true);
  });

  it('intercepts a ctrl-click when button is omitted', () => {
    expect(isNotificationMarkReadClick({ ctrlKey: true })).toBe(true);
  });
});

describe('isNotificationCompanionClick', () => {
  it('does not intercept a plain click', () => {
    expect(isNotificationCompanionClick(plain)).toBe(false);
  });

  it('does not intercept a ctrl-click', () => {
    expect(isNotificationCompanionClick(ctrl)).toBe(false);
  });

  it('does not intercept a shift+ctrl click', () => {
    expect(isNotificationCompanionClick(chord)).toBe(false);
  });

  it('does not intercept a shift auxiliary click', () => {
    expect(isNotificationCompanionClick({ shiftKey: true, button: 1 })).toBe(false);
  });

  it('intercepts a left shift-click', () => {
    expect(isNotificationCompanionClick(shift)).toBe(true);
  });

  it('intercepts a shift-click when button is omitted', () => {
    expect(isNotificationCompanionClick({ shiftKey: true })).toBe(true);
  });
});

describe('isCompanionHost', () => {
  it('does not host a companion from a NOTS docked on a screen', () => {
    expect(isCompanionHost(null)).toBe(false);
    expect(isCompanionHost(undefined)).toBe(false);
  });

  it('hosts a companion from a floating NOTS window', () => {
    expect(isCompanionHost({})).toBe(true);
  });
});

describe('opened notification command', () => {
  it('does not adopt a missing or blank command', () => {
    expect(openedWindowCommand(undefined)).toBeUndefined();
    expect(openedWindowCommand(null)).toBeUndefined();
    expect(openedWindowCommand('')).toBeUndefined();
    expect(openedWindowCommand('  ')).toBeUndefined();
  });

  it('trims the command the game wrote on the opened window', () => {
    expect(openedWindowCommand(' SHPI AB-123 ')).toBe('SHPI AB-123');
  });

  it('does not adopt when the host cannot open a companion', () => {
    expect(shouldAdoptOpenedWindowAsCompanion(false, 'SHPI AB-123')).toBe(false);
  });

  it('does not adopt when the opened window has no command', () => {
    expect(shouldAdoptOpenedWindowAsCompanion(true, undefined)).toBe(false);
  });

  it('adopts when the host can open a companion and the command is known', () => {
    expect(shouldAdoptOpenedWindowAsCompanion(true, 'SHPI AB-123')).toBe(true);
  });
});

describe('companionTarget', () => {
  const vote = 'COGCPD p-KW-688c pn-ADVERTISING_AGRICULTURE';

  it('companions the click command instead of the game default the game opened', () => {
    expect(companionTarget(true, 1, 'COGC KW-688c', vote)).toEqual({
      action: 'companion',
      command: vote,
    });
  });

  it('companions the click command when the game only re-focused its default', () => {
    expect(companionTarget(true, 0, undefined, vote)).toEqual({
      action: 'companion',
      command: vote,
    });
  });

  it('keeps the game target visible when the host cannot split', () => {
    expect(companionTarget(false, 1, undefined, vote)).toEqual({ action: 'unhide' });
    expect(companionTarget(false, 0, undefined, vote)).toEqual({ action: 'leave' });
  });

  it('companions the game target when no click command is registered', () => {
    expect(companionTarget(true, 1, 'SHPI AB-123', undefined)).toEqual({
      action: 'companion',
      command: 'SHPI AB-123',
    });
  });

  it('leaves a re-focused game target alone when no click command is registered', () => {
    expect(companionTarget(true, 0, undefined, undefined)).toEqual({ action: 'leave' });
  });

  it('keeps the game target visible when it cannot be adopted', () => {
    expect(companionTarget(false, 1, 'SHPI AB-123', undefined)).toEqual({ action: 'unhide' });
    expect(companionTarget(true, 1, undefined, undefined)).toEqual({ action: 'unhide' });
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
    expect(topmostWindow([back, front])).toBe(back);
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
