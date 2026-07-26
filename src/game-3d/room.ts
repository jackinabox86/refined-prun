import * as THREE from 'three';

/** Half-extent of the square room on X/Z (full size = 2 * ROOM_HALF). */
export const ROOM_HALF = 5;
export const ROOM_HEIGHT = 3.5;
export const EYE_HEIGHT = 1.6;

/** +Z wall viewscreen opening (world units). */
export const WINDOW_WIDTH = 4;
export const WINDOW_HEIGHT = 2.2;
export const WINDOW_CENTER_Y = 1.8;

const FRAME_DEPTH = 0.15;

/** Procedural panel-line grid for walls/floor (generated once, not per-frame). */
function createPanelTexture(lineColor: string, fillColor: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, size, size);

  const step = 32;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= size; i += step) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
  }
  ctx.stroke();

  // Heavier major lines every 4 panels.
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 0; i <= size; i += step * 4) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Builds an enclosed box room with ambient + directional lighting. */
export function buildRoom(): THREE.Group {
  const group = new THREE.Group();

  const size = ROOM_HALF * 2;

  const wallMap = createPanelTexture('rgba(0, 0, 0, 0.35)', '#5a6a7a');
  wallMap.repeat.set(size / 2, ROOM_HEIGHT / 2);

  const floorMap = createPanelTexture('rgba(0, 0, 0, 0.4)', '#3a4555');
  floorMap.repeat.set(size / 2, size / 2);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aaa,
    map: wallMap,
    side: THREE.BackSide,
    roughness: 0.88,
    metalness: 0.08,
  });
  // +Z face is cut open for the viewscreen; frame segments rebuild the wall around the hole.
  const wallMatOpen = new THREE.MeshStandardMaterial({ visible: false });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x2a3545,
    side: THREE.BackSide,
    roughness: 0.95,
    metalness: 0.02,
  });
  // BoxGeometry groups: +X, -X, +Y (ceiling), -Y (floor, covered by plane), +Z, -Z
  const room = new THREE.Mesh(new THREE.BoxGeometry(size, ROOM_HEIGHT, size), [
    wallMat,
    wallMat,
    ceilingMat,
    wallMat,
    wallMatOpen,
    wallMat,
  ]);
  room.position.y = ROOM_HEIGHT / 2;
  group.add(room);

  // Freestanding frame boxes — DoubleSide so inward faces render (BackSide would cull them).
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aaa,
    map: wallMap,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0.08,
  });
  // Room-facing face flush with the hidden +Z plane at z = ROOM_HALF; thickness extends outward.
  const frameZ = ROOM_HALF + FRAME_DEPTH / 2;

  const topHeight = ROOM_HEIGHT - (WINDOW_CENTER_Y + WINDOW_HEIGHT / 2);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(size, topHeight, FRAME_DEPTH), frameMat);
  frameTop.position.set(0, ROOM_HEIGHT - topHeight / 2, frameZ);
  group.add(frameTop);

  const bottomHeight = WINDOW_CENTER_Y - WINDOW_HEIGHT / 2;
  const frameBottom = new THREE.Mesh(
    new THREE.BoxGeometry(size, bottomHeight, FRAME_DEPTH),
    frameMat,
  );
  frameBottom.position.set(0, bottomHeight / 2, frameZ);
  group.add(frameBottom);

  const sideWidth = (size - WINDOW_WIDTH) / 2;
  const frameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, WINDOW_HEIGHT, FRAME_DEPTH),
    frameMat,
  );
  frameLeft.position.set(-(WINDOW_WIDTH / 2 + sideWidth / 2), WINDOW_CENTER_Y, frameZ);
  group.add(frameLeft);

  const frameRight = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, WINDOW_HEIGHT, FRAME_DEPTH),
    frameMat,
  );
  frameRight.position.set(WINDOW_WIDTH / 2 + sideWidth / 2, WINDOW_CENTER_Y, frameZ);
  group.add(frameRight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size - 0.05, size - 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x6a7a8a,
      map: floorMap,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);

  const ambient = new THREE.AmbientLight(0xb0c4d8, 0.4);
  group.add(ambient);

  const dir = new THREE.DirectionalLight(0xd0e0f0, 0.75);
  dir.position.set(3, 6, 2);
  group.add(dir);

  const point = new THREE.PointLight(0xa8c8e8, 0.45, 20);
  point.position.set(0, ROOM_HEIGHT - 0.5, 0);
  group.add(point);

  // Cool rim fill so opposite walls aren't flat-lit.
  const rim = new THREE.PointLight(0x7090b0, 0.25, 18);
  rim.position.set(-3, ROOM_HEIGHT * 0.6, -2.5);
  group.add(rim);

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
