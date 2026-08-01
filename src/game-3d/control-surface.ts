import { attachIframeRepaintWorkaround, createPanelShell } from '@src/game-3d/buffer-panel';
import type { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/**
 * Per-panel size for a console's control-surface slots. An ExecuteActionPackage window
 * splits into two `Node.child` tiles (the action config + its companion buffer); each
 * gets its own slot (2026-07-26) rather than both being squeezed into one combined
 * placeholder. Landscape proportions make the slot read as a desk-mounted display
 * instead of a wall monitor.
 */
export const CONTROL_SURFACE_WIDTH_PX = 420;
export const CONTROL_SURFACE_HEIGHT_PX = 260;

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
  Object.assign(root.style, {
    padding: '10px 12px',
    background:
      'linear-gradient(160deg, rgba(7, 13, 20, 0.88), rgba(18, 31, 43, 0.72) 55%, rgba(4, 9, 14, 0.9))',
    border: `3px solid ${borderColor}`,
    borderRadius: '4px',
    boxShadow: `inset 0 0 18px rgba(0, 0, 0, 0.6), 0 0 16px color-mix(in srgb, ${borderColor} 34%, transparent)`,
  });

  const placeholder = document.createElement('div');
  placeholder.textContent = 'No action running';
  Object.assign(placeholder.style, {
    alignItems: 'center',
    color: 'rgba(226, 232, 240, 0.7)',
    display: 'flex',
    fontFamily: 'monospace',
    fontSize: '12px',
    height: '100%',
    justifyContent: 'center',
    letterSpacing: '0',
    textTransform: 'uppercase',
  });
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
