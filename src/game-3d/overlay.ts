export type ModeHint = 'walk' | 'interact' | 'focused';

export function createModeOverlay(onExit: () => void) {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'absolute',
    left: '12px',
    top: '12px',
    zIndex: '2',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
    fontFamily: 'system-ui, sans-serif',
    color: '#f7fafc',
  });

  const hint = document.createElement('div');
  Object.assign(hint.style, {
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.65)',
    borderRadius: '4px',
    fontSize: '14px',
    lineHeight: '1.4',
    maxWidth: '320px',
  });

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = 'EXIT 3D';
  Object.assign(exit.style, {
    alignSelf: 'flex-start',
    pointerEvents: 'auto',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: '1px solid #a0aec0',
    background: 'rgba(45, 55, 72, 0.9)',
    color: '#edf2f7',
  });
  exit.addEventListener('click', e => {
    e.stopPropagation();
    onExit();
  });

  root.append(hint, exit);

  let currentMode: ModeHint = 'interact';
  let facingPurpose: string | undefined;
  let focusedPurpose: string | undefined;

  const render = () => {
    if (currentMode === 'walk') {
      if (facingPurpose === undefined) {
        hint.textContent =
          'Walk mode · Esc to interact · WASD to move · Ctrl+Alt+3 or EXIT to leave';
        return;
      }
      hint.textContent = `Walk mode · Facing ${facingPurpose} · Press E to interact · WASD to move · Ctrl+Alt+3 or EXIT to leave`;
      return;
    }
    if (currentMode === 'interact') {
      hint.textContent =
        'Interact mode · Click canvas to look around · Ctrl+Alt+3 or EXIT to leave';
      return;
    }
    hint.textContent = `${focusedPurpose} console · Click screens to interact · Press E to return to walk mode · Ctrl+Alt+3 or EXIT to leave`;
  };

  const setMode = (mode: ModeHint, purpose?: string) => {
    currentMode = mode;
    if (mode === 'focused') {
      focusedPurpose = purpose;
    }
    render();
  };

  const setFacing = (purpose: string | undefined) => {
    if (currentMode !== 'walk') {
      return;
    }
    if (purpose === facingPurpose) {
      return;
    }
    facingPurpose = purpose;
    render();
  };

  setMode('interact');

  return { root, setMode, setFacing };
}
