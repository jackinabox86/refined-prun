import { attachIframeRepaintWorkaround, createPanelShell } from '@src/game-3d/buffer-panel';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/**
 * Per-panel size for a console's control-surface slots. An ExecuteActionPackage window
 * splits into two `Node.child` tiles (the action config + its companion buffer); each
 * gets its own slot (2026-07-26) rather than both being squeezed into one combined
 * placeholder. Height is capped by the vertical gap between the top screen row and the
 * floor (which shrank along with the 30%-shorter console) — see `console.ts`'s
 * `CONTROL_ROW_TOP` for the budget this has to fit inside.
 */
export const CONTROL_SURFACE_WIDTH_PX = 460;
export const CONTROL_SURFACE_HEIGHT_PX = 460;

export interface ControlSurfaceSlot {
  object: CSS3DObject;
  root: HTMLElement;
  /** Reparents `node` (one Node.child tile) into this slot, replacing the placeholder. */
  activate: (node: Element) => void;
  /** Reverts to the dormant placeholder. Does NOT close any window — caller's job. */
  deactivate: () => void;
  dispose: () => void;
}

/** One console's pair of control-surface slots — primary (Node.child[0]) + companion (Node.child[1]). */
export interface ControlSurfacePanels {
  primary: ControlSurfaceSlot;
  companion: ControlSurfaceSlot;
}

export function createControlSurfaceSlot(
  widthPx: number = CONTROL_SURFACE_WIDTH_PX,
  heightPx: number = CONTROL_SURFACE_HEIGHT_PX,
  borderColor?: string,
): ControlSurfaceSlot {
  const { root, targetDiv, object } = createPanelShell(widthPx, heightPx, heightPx, borderColor);

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

/**
 * @param themeColor Console's accent color (same value tinting its pedestal/desk/floor
 *   marker) — used as the panel border so it reads distinctly against the pedestal's
 *   own dark navy instead of blending into it.
 */
export function createControlSurfacePanels(themeColor: number): ControlSurfacePanels {
  const borderColor = `#${themeColor.toString(16).padStart(6, '0')}`;
  return {
    primary: createControlSurfaceSlot(undefined, undefined, borderColor),
    companion: createControlSurfaceSlot(undefined, undefined, borderColor),
  };
}
