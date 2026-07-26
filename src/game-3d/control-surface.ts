import { createPanelShell, SCREEN_SCALE } from '@src/game-3d/buffer-panel';
import type { ConsoleScreenDefinition } from '@src/game-3d/console';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// Mirrors SCREEN_MAX_HEIGHT_WORLD in console.ts — value import would cycle (console → here).
const SCREEN_MAX_HEIGHT_WORLD = 0.7;

export function createControlSurfacePanel(definition: ConsoleScreenDefinition): {
  object: CSS3DObject;
  dispose: () => void;
} {
  const maxHeightPx = Math.round(SCREEN_MAX_HEIGHT_WORLD / SCREEN_SCALE);
  const { targetDiv, object } = createPanelShell(
    definition.widthPx,
    definition.heightPx,
    maxHeightPx,
  );

  const placeholder = document.createElement('div');
  placeholder.textContent = 'Loading control surface…';
  targetDiv.append(placeholder);

  let disposed = false;
  let realWindow: HTMLElement | undefined;

  void (async () => {
    const win = (await showBuffer(definition.command, { autoSubmit: true })) as HTMLElement;
    if (disposed) {
      closePrunWindow(win);
      return;
    }
    realWindow = win;

    win.style.position = 'fixed';
    win.style.left = '-9999px';
    win.style.top = '-9999px';

    const node = await $(win, C.Node.node);
    if (disposed) {
      return;
    }
    targetDiv.replaceChildren(node);
  })();

  const dispose = () => {
    disposed = true;
    if (realWindow) {
      closePrunWindow(realWindow);
    }
  };

  return { object, dispose };
}
