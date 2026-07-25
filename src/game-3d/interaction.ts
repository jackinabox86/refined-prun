import * as THREE from 'three';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { Console } from '@src/game-3d/console';
import type { createModeOverlay } from '@src/game-3d/overlay';

/** World-unit range within which the player can focus a console. */
const INTERACT_DISTANCE = 2.5;

export function createInteraction(
  camera: THREE.PerspectiveCamera,
  controls: PointerLockControls,
  consoles: Console[],
  overlay: ReturnType<typeof createModeOverlay>,
) {
  const hitboxes = consoles.map(x => x.hitbox);
  const purposeById = new Map(consoles.map(x => [x.definition.id, x.definition.purpose]));

  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_DISTANCE;
  const forward = new THREE.Vector3();

  let facingConsoleId: string | undefined;
  let focusedConsoleId: string | undefined;

  const onLock = () => {
    focusedConsoleId = undefined;
    overlay.setMode('walk');
  };

  const onUnlock = () => {
    if (focusedConsoleId === undefined) {
      overlay.setMode('interact');
      return;
    }
    overlay.setMode('focused', purposeById.get(focusedConsoleId));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'KeyE') {
      return;
    }

    if (focusedConsoleId !== undefined) {
      focusedConsoleId = undefined;
      controls.lock();
      return;
    }

    if (controls.isLocked && facingConsoleId !== undefined) {
      focusedConsoleId = facingConsoleId;
      controls.unlock();
    }
  };

  const attach = () => {
    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);
    window.addEventListener('keydown', onKeyDown);
  };

  const detach = () => {
    controls.removeEventListener('lock', onLock);
    controls.removeEventListener('unlock', onUnlock);
    window.removeEventListener('keydown', onKeyDown);
  };

  const update = () => {
    if (!controls.isLocked) {
      return;
    }

    camera.getWorldDirection(forward);
    raycaster.set(camera.position, forward);
    const hits = raycaster.intersectObjects(hitboxes, false);
    const nextId =
      hits.length > 0 ? (hits[0]!.object.userData.consoleId as string | undefined) : undefined;

    if (nextId === facingConsoleId) {
      return;
    }

    facingConsoleId = nextId;
    const purpose = nextId === undefined ? undefined : purposeById.get(nextId);
    overlay.setFacing(purpose);
  };

  return { attach, detach, update };
}
