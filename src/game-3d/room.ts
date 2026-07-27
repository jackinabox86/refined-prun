import * as THREE from 'three';

/**
 * Half-extent of the square room on X/Z (full size = 2 * ROOM_HALF).
 * Bumped from 5 (2026-07-26 playtest feedback) — consoles now spread across all
 * four walls (console-roster.ts) instead of a single narrow arc, and need more
 * floor space between them and the center hologram/walk path.
 */
export const ROOM_HALF = 8;
export const ROOM_HEIGHT = 3.5;
export const EYE_HEIGHT = 1.6;

/**
 * -Z wall viewscreen opening (world units). Sized to 80% of that wall's own width/height
 * (2026-07-26 playtest feedback: "make the viewport take up 80% of the available area of
 * the wall it is currently on"), centered both ways.
 */
const WINDOW_WALL_FRACTION = 0.8;
export const WINDOW_WIDTH = ROOM_HALF * 2 * WINDOW_WALL_FRACTION;
export const WINDOW_HEIGHT = ROOM_HEIGHT * WINDOW_WALL_FRACTION;
export const WINDOW_CENTER_Y = ROOM_HEIGHT / 2;

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

/**
 * Normal + roughness maps matching createPanelTexture's grid — same 256px/32px-step
 * layout, generated once. Seams read as shallow recessed grooves.
 */
function createPanelBumpMaps(): {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const step = 32;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;
  hctx.fillStyle = '#ffffff';
  hctx.fillRect(0, 0, size, size);
  hctx.strokeStyle = '#404040';
  hctx.lineWidth = 2;
  hctx.beginPath();
  for (let i = 0; i <= size; i += step) {
    hctx.moveTo(i, 0);
    hctx.lineTo(i, size);
    hctx.moveTo(0, i);
    hctx.lineTo(size, i);
  }
  hctx.stroke();
  hctx.lineWidth = 3;
  hctx.strokeStyle = '#202020';
  hctx.beginPath();
  for (let i = 0; i <= size; i += step * 4) {
    hctx.moveTo(i, 0);
    hctx.lineTo(i, size);
    hctx.moveTo(0, i);
    hctx.lineTo(size, i);
  }
  hctx.stroke();

  const heightData = hctx.getImageData(0, 0, size, size).data;
  const heightAt = (x: number, y: number) => {
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    return heightData[(yi * size + xi) * 4]! / 255;
  };

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d')!;
  const normalImage = nctx.createImageData(size, size);
  const strength = 2.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const idx = (y * size + x) * 4;
      normalImage.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 3] = 255;
    }
  }
  nctx.putImageData(normalImage, 0, 0);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#a0a0a0';
  rctx.fillRect(0, 0, size, size);
  rctx.strokeStyle = '#e0e0e0';
  rctx.lineWidth = 2;
  rctx.beginPath();
  for (let i = 0; i <= size; i += step) {
    rctx.moveTo(i, 0);
    rctx.lineTo(i, size);
    rctx.moveTo(0, i);
    rctx.lineTo(size, i);
  }
  rctx.stroke();

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  return { normalMap, roughnessMap };
}

/** Builds an enclosed box room with ambient + directional lighting. */
export function buildRoom(): THREE.Group {
  const group = new THREE.Group();

  const size = ROOM_HALF * 2;

  const wallMap = createPanelTexture('rgba(0, 0, 0, 0.35)', '#5a6a7a');
  wallMap.repeat.set(size / 2, ROOM_HEIGHT / 2);

  const floorMap = createPanelTexture('rgba(0, 0, 0, 0.4)', '#3a4555');
  floorMap.repeat.set(size / 2, size / 2);

  const wallBump = createPanelBumpMaps();
  wallBump.normalMap.repeat.set(size / 2, ROOM_HEIGHT / 2);
  wallBump.roughnessMap.repeat.set(size / 2, ROOM_HEIGHT / 2);

  const floorBump = createPanelBumpMaps();
  floorBump.normalMap.repeat.set(size / 2, size / 2);
  floorBump.roughnessMap.repeat.set(size / 2, size / 2);

  const normalScale = new THREE.Vector2(0.6, 0.6);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aaa,
    map: wallMap,
    normalMap: wallBump.normalMap,
    normalScale,
    roughnessMap: wallBump.roughnessMap,
    side: THREE.BackSide,
    roughness: 0.88,
    metalness: 0.08,
  });
  // -Z face is cut open for the viewscreen; frame segments rebuild the wall around the hole.
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
    wallMat,
    wallMatOpen,
  ]);
  room.position.y = ROOM_HEIGHT / 2;
  group.add(room);

  // Freestanding frame boxes — DoubleSide so inward faces render (BackSide would cull them).
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aaa,
    map: wallMap,
    normalMap: wallBump.normalMap,
    normalScale,
    roughnessMap: wallBump.roughnessMap,
    side: THREE.DoubleSide,
    roughness: 0.88,
    metalness: 0.08,
  });
  // Room-facing face flush with the hidden -Z plane at z = -ROOM_HALF; thickness extends outward.
  const frameZ = -(ROOM_HALF + FRAME_DEPTH / 2);

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
      normalMap: floorBump.normalMap,
      normalScale,
      roughnessMap: floorBump.roughnessMap,
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
