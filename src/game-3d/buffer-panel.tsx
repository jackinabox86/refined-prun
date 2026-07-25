import { Teleport } from 'vue';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ROOM_HALF, ROOM_HEIGHT } from '@src/game-3d/room';
import { tileStatePlugin } from '@src/store/user-data-tiles';
// Game-3d is explicitly permitted to import buffer components from features/XIT/
// (see docs/architecture.md's game-3d section) — a deliberate, permanent exception.
import INV from '@src/features/XIT/INV/INV.vue';
import CALC from '@src/features/XIT/CALC.vue';

function createPanelShell(widthPx: number, heightPx?: number) {
  const root = document.createElement('div');
  Object.assign(root.style, {
    width: `${widthPx}px`,
    ...(heightPx === undefined ? {} : { height: `${heightPx}px` }),
    padding: '16px 20px',
    boxSizing: 'border-box',
    background: 'rgba(20, 28, 40, 0.92)',
    border: '2px solid #63b3ed',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    pointerEvents: 'auto',
    userSelect: 'none',
    position: 'relative',
  });

  const targetDiv = document.createElement('div');
  Object.assign(targetDiv.style, {
    width: '100%',
    height: heightPx === undefined ? 'auto' : '100%',
    position: 'relative',
  });
  root.append(targetDiv);

  const object = new CSS3DObject(root);
  // Pixel → world scale so the panel reads as wall-sized.
  object.scale.setScalar(0.01);

  return { root, targetDiv, object };
}

/**
 * Wall-mounted CSS3D panel hosting a teleported INV buffer.
 * Returns the scene object plus the FragmentApp so the caller can unmount it
 * (appendTo(document.body) never auto-unmounts).
 */
export function createBufferPanel() {
  const { targetDiv, object } = createPanelShell(700);
  // Mount on the -Z wall, facing the room center.
  object.position.set(0, ROOM_HEIGHT * 0.55, -ROOM_HALF + 0.05);
  object.rotation.y = 0;

  // INV.vue uses useTileState() → inject(tileStateKey())!, which needs tileStatePlugin
  // provided by an ancestor. Real XIT hosts install this; the spike must do it itself.
  const app = createFragmentApp(() => (
    <Teleport to={targetDiv}>
      <INV />
    </Teleport>
  )).use(tileStatePlugin, { tile: 'game-3d-inv-panel' });
  app.appendTo(document.body);

  return { object, app };
}

/**
 * Wall-mounted CSS3D panel hosting XIT CALC (static iframe) for Phase 2 iframe-in-CSS3D
 * verification. No tileStatePlugin — CALC has no ambient Vue context deps.
 */
export function createCalcPanel() {
  // Matches CALC.ts bufferSize so the iframe (height: 100%) has a real box.
  const { root, targetDiv, object } = createPanelShell(275, 326);
  // +X wall; local +Z (CSS3D front) → -X via -π/2 so the panel faces the room center.
  object.position.set(ROOM_HALF - 0.05, ROOM_HEIGHT * 0.55, 0);
  object.rotation.y = -Math.PI / 2;

  const app = createFragmentApp(() => (
    <Teleport to={targetDiv}>
      <CALC />
    </Teleport>
  ));
  app.appendTo(document.body);

  // Chromium often fails to paint cross-origin iframes under CSS3D matrix3d; force a recomp after load.
  let iframe: HTMLIFrameElement | undefined;
  let observer: MutationObserver | undefined;

  const onIframeLoad = () => {
    root.style.display = 'none';
    void root.offsetHeight;
    requestAnimationFrame(() => {
      root.style.display = '';
    });
  };

  const attachToIframe = (el: HTMLIFrameElement) => {
    if (iframe !== undefined) {
      return;
    }
    iframe = el;
    iframe.addEventListener('load', onIframeLoad);
    if (observer !== undefined) {
      observer.disconnect();
      observer = undefined;
    }
  };

  const tryFindIframe = () => {
    const found = targetDiv.querySelector('iframe');
    if (found === null) {
      return;
    }
    attachToIframe(found);
  };

  observer = new MutationObserver(() => {
    tryFindIframe();
  });
  observer.observe(targetDiv, { childList: true, subtree: true });
  tryFindIframe();

  const dispose = () => {
    if (observer !== undefined) {
      observer.disconnect();
      observer = undefined;
    }
    if (iframe === undefined) {
      return;
    }
    iframe.removeEventListener('load', onIframeLoad);
    iframe = undefined;
  };

  return { object, app, dispose };
}
