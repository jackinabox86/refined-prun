import { OVERLAY_Z_INDEX } from '@src/game-3d/Renderer';

const WINDOW_Z_INDEX = String(OVERLAY_Z_INDEX + 1);

function raiseWindow(el: Element) {
  const htmlEl = el as HTMLElement;
  // Skip when already set — avoids re-triggering our own attribute observer.
  if (htmlEl.style.zIndex === WINDOW_Z_INDEX) {
    return;
  }
  htmlEl.style.zIndex = WINDOW_Z_INDEX;
}

function processNode(node: Node) {
  if (!(node instanceof Element)) {
    return;
  }
  if (node.classList.contains(C.Window.window)) {
    raiseWindow(node);
  }
  const windows = node.querySelectorAll('.' + C.Window.window);
  for (let i = 0; i < windows.length; i++) {
    raiseWindow(windows[i]);
  }
}

export function createBufferWindowGuard() {
  let observer: MutationObserver | undefined;

  const attach = () => {
    if (observer !== undefined) {
      return;
    }
    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          // Game rewrites style (including zIndex) on focus/drag; re-raise.
          const target = mutation.target;
          if (target instanceof Element && target.classList.contains(C.Window.window)) {
            raiseWindow(target);
          }
          continue;
        }
        const added = mutation.addedNodes;
        for (let i = 0; i < added.length; i++) {
          processNode(added[i]);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  };

  const detach = () => {
    if (observer === undefined) {
      return;
    }
    observer.disconnect();
    observer = undefined;
  };

  return { attach, detach };
}
