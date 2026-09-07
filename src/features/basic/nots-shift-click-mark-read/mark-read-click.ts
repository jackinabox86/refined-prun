export function isNotificationMarkReadClick(event: { shiftKey: boolean; button?: number }) {
  return event.shiftKey && (event.button === undefined || event.button === 0);
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

export function topmostWindow<T>(windows: ArrayLike<T>) {
  let top: T | undefined;
  let topZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < windows.length; i++) {
    const candidate = windows[i];
    const z = windowStackIndex(candidate);
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
