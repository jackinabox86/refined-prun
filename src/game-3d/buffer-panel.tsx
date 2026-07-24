import { Teleport } from 'vue';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { ROOM_HALF, ROOM_HEIGHT } from '@src/game-3d/room';
import { tileStatePlugin } from '@src/store/user-data-tiles';
// Spike-only cross-layer import; revisit (e.g. shared buffer location) once past spike status.
import INV from '@src/features/XIT/INV/INV.vue';

/**
 * Wall-mounted CSS3D panel hosting a teleported INV buffer.
 * Returns the scene object plus the FragmentApp so the caller can unmount it
 * (appendTo(document.body) never auto-unmounts).
 */
export function createBufferPanel() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    width: '700px',
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
