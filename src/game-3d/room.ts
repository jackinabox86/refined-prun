import * as THREE from 'three';

/** Half-extent of the square room on X/Z (full size = 2 * ROOM_HALF). */
export const ROOM_HALF = 5;
export const ROOM_HEIGHT = 3.5;
export const EYE_HEIGHT = 1.6;

/** Builds an enclosed box room with ambient + directional lighting. */
export function buildRoom(): THREE.Group {
  const group = new THREE.Group();

  const size = ROOM_HALF * 2;
  const geometry = new THREE.BoxGeometry(size, ROOM_HEIGHT, size);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    side: THREE.BackSide,
    roughness: 0.85,
    metalness: 0.05,
  });
  const room = new THREE.Mesh(geometry, material);
  room.position.y = ROOM_HEIGHT / 2;
  group.add(room);

  // Floor accent so orientation is obvious.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size - 0.05, size - 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  group.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 6, 2);
  group.add(dir);

  const point = new THREE.PointLight(0xffe0b0, 0.6, 20);
  point.position.set(0, ROOM_HEIGHT - 0.5, 0);
  group.add(point);

  return group;
}

/** Clamps camera XZ to stay roughly inside the room; keeps eye height fixed. */
export function clampToRoom(position: THREE.Vector3) {
  const margin = 0.4;
  const max = ROOM_HALF - margin;
  position.x = Math.min(max, Math.max(-max, position.x));
  position.z = Math.min(max, Math.max(-max, position.z));
  position.y = EYE_HEIGHT;
}
