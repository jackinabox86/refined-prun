import { Teleport } from 'vue';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ROOM_HALF, ROOM_HEIGHT } from '@src/game-3d/room';
// Spike-only cross-layer import; revisit (e.g. shared buffer location) once past spike status.
import HEALTH from '@src/features/XIT/HEALTH.vue';

/**
 * Wall-mounted CSS3D panel hosting a teleported HEALTH buffer.
 * Returns the scene object plus the FragmentApp so the caller can unmount it
 * (appendTo(document.body) never auto-unmounts).
 */
export function createBufferPanel() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    width: '600px',
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
  });

  const targetDiv = document.createElement('div');
  Object.assign(targetDiv.style, {
    width: '100%',
  });
  root.append(targetDiv);

  const object = new CSS3DObject(root);
  // Pixel → world scale so the panel reads as wall-sized.
  object.scale.setScalar(0.01);
  // Mount on the -Z wall, facing the room center.
  object.position.set(0, ROOM_HEIGHT * 0.55, -ROOM_HALF + 0.05);
  object.rotation.y = 0;

  const app = createFragmentApp(() => (
    <Teleport to={targetDiv}>
      <HEALTH />
    </Teleport>
  ));
  app.appendTo(document.body);

  return { object, app };
}
