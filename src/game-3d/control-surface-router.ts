import type { ControlSurfacePanels } from '@src/game-3d/control-surface';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';

/**
 * Dynamically captures ExecuteActionPackage windows opened while a console is
 * focused and reparents each of the split node's two Node.child tiles (action
 * config + companion buffer) into that console's own control-surface panel.
 * Detection mirrors buffer-window-guard.ts (MutationObserver on document.body).
 */
export function createControlSurfaceRouter(
  panels: Map<string, ControlSurfacePanels>,
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
    const pair = panels.get(consoleId);
    if (pair === undefined) {
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

    // Two Node.child tiles expected (action config + companion buffer, per
    // getCompanionTile in tile-allocator.ts); anything else isn't the shape we know
    // how to split across the two desk panels.
    const children = _$$(splitNode, C.Node.child);
    if (children.length !== 2) {
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
    pair.primary.activate(children[0]!);
    pair.companion.activate(children[1]!);
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
