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

  // A freshly-opened window isn't split into Node.node/Node.child yet: TileAllocator's
  // splitBuffer() (tile-allocator.ts) dispatches its real `click` via clickElement(),
  // which defers that dispatch behind `await sleep(0)` — a setTimeout macrotask. This
  // MutationObserver's callback runs as a microtask, strictly *before* the next
  // macrotask, so the split has never happened yet the first time a window is seen.
  // SPLIT_WATCH_TIMEOUT_MS bounds how long we keep watching a not-yet-split window
  // before assuming it's some other window type that will never split.
  const SPLIT_WATCH_TIMEOUT_MS = 2000;

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

    const splitNode = _$(win, C.Node.node);
    if (splitNode === undefined) {
      // Not split yet (see comment above) — keep watching this specific window for
      // the split to land instead of giving up permanently. Scoping the observer to
      // `win` (rather than reusing the body-wide one) keeps this cheap and
      // self-contained; it disconnects itself on success or timeout.
      watchForSplit(win, consoleId, pair);
      return;
    }
    captureSplit(win, consoleId, pair, splitNode);
  }

  function watchForSplit(win: HTMLElement, consoleId: string, pair: ControlSurfacePanels) {
    let settled = false;
    const splitObserver = new MutationObserver(() => {
      if (settled) {
        return;
      }
      const splitNode = _$(win, C.Node.node);
      if (splitNode === undefined) {
        return;
      }
      settled = true;
      splitObserver.disconnect();
      clearTimeout(timeout);
      captureSplit(win, consoleId, pair, splitNode);
    });
    splitObserver.observe(win, { childList: true, subtree: true });
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      splitObserver.disconnect();
    }, SPLIT_WATCH_TIMEOUT_MS);
  }

  function captureSplit(
    win: HTMLElement,
    consoleId: string,
    pair: ControlSurfacePanels,
    splitNode: HTMLElement,
  ) {
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
