import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/**
 * Pixel → world scale for CSS3D screens. Tuned for a console you walk up to
 * (a ~700px panel reads as ~1.1 world-unit/meter monitor), not the original
 * spike's flat wall-mounted panels (which is what the old 0.01 was tuned for).
 */
export const SCREEN_SCALE = 0.0016;

export function createPanelShell(widthPx: number, heightPx?: number) {
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
  object.scale.setScalar(SCREEN_SCALE);

  return { root, targetDiv, object };
}

/**
 * Chromium often fails to paint cross-origin iframes under CSS3D matrix3d;
 * force a recomp after any iframe under the panel loads. Safe no-op cost when
 * the mounted component never renders an iframe.
 */
export function attachIframeRepaintWorkaround(
  root: HTMLDivElement,
  targetDiv: HTMLDivElement,
): () => void {
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

  return () => {
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
}
