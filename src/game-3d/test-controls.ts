import * as THREE from 'three';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

type TestControlsApi = {
  rotate: (yawDeg: number, pitchDeg: number) => void;
  move: (forward: number, right: number) => void;
};

type WindowWithTestControls = Window & {
  __rpGame3DTest?: TestControlsApi;
};

export function createTestControls(camera: THREE.PerspectiveCamera, controls: PointerLockControls) {
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  const rotate = (yawDeg: number, pitchDeg: number) => {
    // Mirror PointerLockControls' internal mousemove handler: YXZ euler,
    // relative deltas, pitch clamped to ±π/2 so the camera never flips.
    euler.setFromQuaternion(camera.quaternion);
    euler.y += THREE.MathUtils.degToRad(yawDeg);
    euler.x += THREE.MathUtils.degToRad(pitchDeg);
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  };

  const move = (forward: number, right: number) => {
    // These PointerLockControls methods already work regardless of isLocked —
    // the isLocked gate is only in our movement.ts update path, not three.js.
    controls.moveForward(forward);
    controls.moveRight(right);
  };

  const attach = () => {
    (window as WindowWithTestControls).__rpGame3DTest = { rotate, move };
  };

  const detach = () => {
    delete (window as WindowWithTestControls).__rpGame3DTest;
  };

  return { attach, detach };
}
