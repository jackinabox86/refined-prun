type NotificationClick = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  button?: number;
};

function isPrimaryClick(event: NotificationClick) {
  return event.button === undefined || event.button === 0;
}

// Ctrl-click is the hidden mark-read gesture. Shift-click is the companion
// gesture, so a chord of both is neither.
export function isNotificationMarkReadClick(event: NotificationClick) {
  return event.ctrlKey === true && event.shiftKey !== true && isPrimaryClick(event);
}

export function isNotificationCompanionClick(event: NotificationClick) {
  return event.shiftKey === true && event.ctrlKey !== true && isPrimaryClick(event);
}

// Shift-click companions only from a floating NOTS window. A NOTS docked on a
// screen sits among buffers the player placed there, so shift-click falls back
// to the game's plain click. Ctrl-click mark-read works in either host.
export function isCompanionHost(window: object | null | undefined) {
  return window != null;
}

export function openedWindowCommand(commandText: string | null | undefined) {
  const command = commandText?.trim() ?? '';
  if (command === '') {
    return undefined;
  }
  return command;
}

// Only adopt when the host can split and the game actually labeled the window
// it opened.
export function shouldAdoptOpenedWindowAsCompanion(
  canCompanion: boolean,
  command: string | undefined,
) {
  return canCompanion && command !== undefined;
}

export type CompanionTarget =
  | { action: 'leave' }
  | { action: 'unhide' }
  | { action: 'companion'; command: string };

// A registered click command replaces whatever the game opened, the same buffer
// a plain click opens. It opens even when the game only re-focused a buffer,
// because that buffer is the game default, not the replacement.
export function companionTarget(
  canCompanion: boolean,
  openedCount: number,
  openedCommand: string | undefined,
  clickCommand: string | undefined,
): CompanionTarget {
  if (clickCommand !== undefined && canCompanion) {
    return { action: 'companion', command: clickCommand };
  }
  if (openedCount === 0) {
    return { action: 'leave' };
  }
  if (!shouldAdoptOpenedWindowAsCompanion(canCompanion, openedCommand)) {
    return { action: 'unhide' };
  }
  return { action: 'companion', command: openedCommand! };
}

export function snapshotWindows(windows: ArrayLike<Element>) {
  return new Set(Array.from(windows));
}

export function newlyOpenedWindows(before: ReadonlySet<Element>, after: ArrayLike<Element>) {
  const opened: Element[] = [];
  for (let i = 0; i < after.length; i++) {
    if (!before.has(after[i])) {
      opened.push(after[i]);
    }
  }
  return opened;
}

export function windowStackIndex(windowEl: unknown) {
  if (typeof windowEl !== 'object' || windowEl === null || !('style' in windowEl)) {
    return 0;
  }
  const z = Number.parseInt((windowEl as { style?: { zIndex?: string } }).style?.zIndex ?? '', 10);
  return Number.isNaN(z) ? 0 : z;
}

export function windowContainingClick<T>(target: unknown, windows: ArrayLike<T>) {
  if (target == null) {
    return undefined;
  }
  for (let i = 0; i < windows.length; i++) {
    const windowEl = windows[i];
    if (
      typeof windowEl === 'object' &&
      windowEl !== null &&
      'contains' in windowEl &&
      typeof windowEl.contains === 'function' &&
      (windowEl.contains as (node: unknown) => boolean)(target)
    ) {
      return windowEl;
    }
  }
  return undefined;
}

export function topmostWindow<T>(windows: ArrayLike<T>) {
  let top: T | undefined;
  let topZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < windows.length; i++) {
    const candidate = windows[i];
    const z = windowStackIndex(candidate);
    // Last in document order wins a z-index tie.
    if (top === undefined || z >= topZ) {
      top = candidate;
      topZ = z;
    }
  }
  return top;
}

export function shouldRestorePriorWindow(
  openedCount: number,
  prior: object | null | undefined,
  current: object | null | undefined,
) {
  return openedCount === 0 && prior != null && current != null && prior !== current;
}

export function closeOrUnhide(close: () => void, unhide: () => void) {
  try {
    close();
  } catch {
    unhide();
  }
}
