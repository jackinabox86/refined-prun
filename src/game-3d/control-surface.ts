import {
  attachIframeRepaintWorkaround,
  createPanelShell,
  SCREEN_SCALE,
} from '@src/game-3d/buffer-panel';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// Mirrors SCREEN_MAX_HEIGHT_WORLD in console.ts — value import would cycle (console → here).
const SCREEN_MAX_HEIGHT_WORLD = 0.7;

/** Default size for every console's dormant control-surface slot. */
export const CONTROL_SURFACE_WIDTH_PX = 900;
export const CONTROL_SURFACE_HEIGHT_PX = 420;

export interface ControlSurfaceSlot {
  object: CSS3DObject;
  root: HTMLElement;
  /** Reparents `node` (a real window's C.Node.node wrapper) into this slot, replacing the placeholder. */
  activate: (node: Element) => void;
  /** Reverts to the dormant placeholder. Does NOT close any window — caller's job. */
  deactivate: () => void;
  dispose: () => void;
}

export function createControlSurfaceSlot(
  widthPx: number = CONTROL_SURFACE_WIDTH_PX,
  heightPx: number = CONTROL_SURFACE_HEIGHT_PX,
): ControlSurfaceSlot {
  const maxHeightPx = Math.round(SCREEN_MAX_HEIGHT_WORLD / SCREEN_SCALE);
  const { root, targetDiv, object } = createPanelShell(widthPx, heightPx, maxHeightPx);

  const placeholder = document.createElement('div');
  placeholder.textContent = 'No action running';
  targetDiv.append(placeholder);

  const disposeIframe = attachIframeRepaintWorkaround(root, targetDiv);

  const activate = (node: Element) => {
    targetDiv.replaceChildren(node);
  };

  const deactivate = () => {
    targetDiv.replaceChildren(placeholder);
  };

  const dispose = () => {
    disposeIframe();
    deactivate();
  };

  return { object, root, activate, deactivate, dispose };
}
