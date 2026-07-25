export async function toggleGame3D() {
  const state: { indicator: HTMLDivElement | null } = { indicator: null };
  const timer = window.setTimeout(() => {
    const el = document.createElement('div');
    el.textContent = 'Loading 3D mode…';
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '2147483647',
      padding: '8px 12px',
      background: 'rgba(0, 0, 0, 0.65)',
      borderRadius: '4px',
      fontSize: '14px',
      lineHeight: '1.4',
      fontFamily: 'system-ui, sans-serif',
      color: '#f7fafc',
      pointerEvents: 'none',
    });
    document.body.appendChild(el);
    state.indicator = el;
  }, 150);

  let launchGame3D: (() => void) | undefined;
  try {
    ({ launchGame3D } = await import('@src/game-3d'));
  } catch (err) {
    console.error('[game-3d] failed to launch', err);
  } finally {
    window.clearTimeout(timer);
    state.indicator?.remove();
  }

  launchGame3D?.();
}
