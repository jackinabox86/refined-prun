import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ROOM_HALF, ROOM_HEIGHT } from '@src/game-3d/room';

/** Builds a wall-mounted CSS3D panel with an interactive counter button. */
export function createTestPanel() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    width: '480px',
    padding: '24px 28px',
    boxSizing: 'border-box',
    background: 'rgba(20, 28, 40, 0.92)',
    border: '2px solid #63b3ed',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '18px',
    pointerEvents: 'auto',
    userSelect: 'none',
  });

  const title = document.createElement('div');
  title.textContent = 'CSS3D test panel';
  Object.assign(title.style, {
    fontWeight: '600',
    marginBottom: '12px',
  });

  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Increment';
  Object.assign(button.style, {
    padding: '8px 14px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: '1px solid #63b3ed',
    background: '#2b6cb0',
    color: '#fff',
  });

  let count = 0;
  const counter = document.createElement('span');
  counter.textContent = 'Count: 0';

  button.addEventListener('click', e => {
    // Keep the click from bubbling to any canvas re-lock handler.
    e.stopPropagation();
    count += 1;
    counter.textContent = `Count: ${count}`;
  });

  row.append(button, counter);
  root.append(title, row);

  const object = new CSS3DObject(root);
  // Pixel → world scale so the panel reads as wall-sized.
  object.scale.setScalar(0.01);
  // Mount on the -Z wall, facing the room center.
  object.position.set(0, ROOM_HEIGHT * 0.55, -ROOM_HALF + 0.05);
  object.rotation.y = 0;

  return object;
}
