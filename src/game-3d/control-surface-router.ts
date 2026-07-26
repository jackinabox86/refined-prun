import type { ControlSurfaceSlot } from '@src/game-3d/control-surface';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';

/**
 * Dynamically captures ExecuteActionPackage windows opened while a console is
 * focused and reparents their split node into that console's control-surface slot.
 * Detection mirrors buffer-window-guard.ts (MutationObserver on document.body).
 */
export function createControlSurfaceRouter(
  slots: Map<string, ControlSurfaceSlot>,
  getFocusedConsoleId: () => string | undefined,
) {
  // Active[consoleId] = the real (parked off-screen) window element currently captured.
  const active = new Map<string, HTMLElement>();

  function processNode(node: Node) {
    if (!(node instanceof Element)) {
      return;
    }
    const candidates = node.classList.contains(C.Window.window)
      ? [node]
      : Array.from(node.querySelectorAll('.' + C.Window.window));
    for (const win of candidates) {
      tryCapture(win as HTMLElement);
    }
  }

  function tryCapture(win: HTMLElement) {
    const consoleId = getFocusedConsoleId();
    if (consoleId === undefined) {
      // Not focused on any console — leave as a normal 2D window.
      return;
    }
    const slot = slots.get(consoleId);
    if (slot === undefined) {
      return;
    }

    // Synchronous check — TileAllocator's split fires at mount, so by the time this
    // MutationObserver callback runs (microtask, after the synchronous mount), it's
    // already present if this is really an ExecuteActionPackage window. Use `_$`
    // (synchronous get-or-undefined), NOT `$` (which waits indefinitely and would hang
    // forever for a non-ACT window that will never split).
    const splitNode = _$(win, C.Node.node);
    if (splitNode === undefined) {
      // Some other kind of window — leave it alone entirely.
      return;
    }

    // Replace any previous capture on this console first, so we don't orphan a window.
    const previous = active.get(consoleId);
    if (previous !== undefined) {
      closePrunWindow(previous);
    }

    win.style.position = 'fixed';
    win.style.left = '-9999px';
    win.style.top = '-9999px';
    active.set(consoleId, win);
    slot.activate(splitNode);
  }

  let observer: MutationObserver | undefined;

  const attach = () => {
    if (observer !== undefined) {
      return;
    }
    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          processNode(mutation.addedNodes[i]!);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const detach = () => {
    observer?.disconnect();
    observer = undefined;
  };

  const dispose = () => {
    detach();
    for (const win of active.values()) {
      closePrunWindow(win);
    }
    active.clear();
  };

  return { attach, detach, dispose };
}
