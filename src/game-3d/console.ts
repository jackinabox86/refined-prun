import * as THREE from 'three';
import { h, Teleport } from 'vue';
import {
  attachIframeRepaintWorkaround,
  createPanelShell,
  SCREEN_SCALE,
} from '@src/game-3d/buffer-panel';
import {
  CONTROL_SURFACE_HEIGHT_PX,
  CONTROL_SURFACE_WIDTH_PX,
  createControlSurfacePanels,
} from '@src/game-3d/control-surface';
import { createPanelHitPlane, type PanelHitTarget } from '@src/game-3d/panel-hit-test';
import { ROOM_HEIGHT } from '@src/game-3d/room';
import { tileStatePlugin } from '@src/store/user-data-tiles';

export interface ConsoleScreenDefinition {
  command: string;
  widthPx: number;
  heightPx?: number;
}

export interface ConsoleDefinition {
  id: string;
  purpose: string;
  position: THREE.Vector3;
  rotationY: number;
  themeColor: number;
  screens: ConsoleScreenDefinition[];
}

/** World-unit gap between adjacent screens/panels so borders don't touch. */
const SCREEN_GAP = 0.2;

/** Screens must not visually extend below the desk (top ≈ y=-0.4); small clearance kept. */
export const SCREEN_MAX_HEIGHT_WORLD = 0.7;

/** Ten-degree keyboard-deck pitch; CSS3D control panels rotate to match this surface normal. */
const DESK_TILT = 0.1745;
/** Screen row leans back from vertical like an open laptop lid. */
const SCREEN_BACK_TILT = -0.24;
/** Top screens are visually larger than desk-mounted control panels without changing DOM pixels. */
const TOP_SCREEN_SCALE_BOOST = 0.94;
/** Extra rearward set-back from the desktop rear edge for the top screen row. */
const TOP_SCREEN_REAR_OFFSET = -0.32;
/** Center of the thin desktop slab that carries the control-surface panels. */
const DESKTOP_CENTER = new THREE.Vector3(0, -0.42, 0.16);
const DESKTOP_THICKNESS = 0.1;
const DESKTOP_DEPTH = 0.54;
const DESKTOP_SURFACE_CLEARANCE = 0.012;
const SCREEN_STACK_DEPTH_STAGGER = DESKTOP_DEPTH * 0.28;
const SCREEN_STACK_X_OFFSET = -0.62;

interface ConsoleTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

interface ScreenFrameSpec {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  width: number;
  height: number;
}

interface FacePanelSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function createConsoleMetalTextures(seed: number, baseColor: [number, number, number]) {
  const size = 512;
  const rng = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const [br, bg, bb] = baseColor;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const f = 0.84 + rng() * 0.24;
    ctx.fillStyle = `rgba(${clamp255(br * f)},${clamp255(bg * f)},${clamp255(bb * f)},0.34)`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 180; i++) {
    const edge = Math.floor(rng() * 4);
    const spread = 8 + rng() * 28;
    const alpha = 0.06 + rng() * 0.12;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    if (edge === 0) {
      ctx.fillRect(rng() * size, rng() * spread, 1 + rng() * 5, 1 + rng() * 10);
    } else if (edge === 1) {
      ctx.fillRect(rng() * size, size - rng() * spread, 1 + rng() * 5, 1 + rng() * 10);
    } else if (edge === 2) {
      ctx.fillRect(rng() * spread, rng() * size, 1 + rng() * 10, 1 + rng() * 5);
    } else {
      ctx.fillRect(size - rng() * spread, rng() * size, 1 + rng() * 10, 1 + rng() * 5);
    }
  }
  const edgeGradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.22,
    size / 2,
    size / 2,
    size * 0.72,
  );
  edgeGradient.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(4,8,12,0.78)';
  ctx.lineWidth = 2;
  for (const p of [0, size * 0.25, size * 0.5, size * 0.75, size]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    const y = rng() * size;
    const x = rng() * size;
    const len = 20 + rng() * 70;
    ctx.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(size, x + len), y + (rng() - 0.5) * 3);
    ctx.stroke();
  }

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;
  hctx.fillStyle = '#d8d8d8';
  hctx.fillRect(0, 0, size, size);
  hctx.strokeStyle = '#181818';
  hctx.lineWidth = 3;
  for (const p of [0, size * 0.25, size * 0.5, size * 0.75, size]) {
    hctx.beginPath();
    hctx.moveTo(p, 0);
    hctx.lineTo(p, size);
    hctx.stroke();
    hctx.beginPath();
    hctx.moveTo(0, p);
    hctx.lineTo(size, p);
    hctx.stroke();
  }
  hctx.strokeStyle = 'rgba(110,110,110,0.42)';
  hctx.lineWidth = 1;
  for (let y = 0; y < size; y += 3) {
    hctx.beginPath();
    hctx.moveTo(0, y);
    hctx.lineTo(size, y + (rng() - 0.5) * 2);
    hctx.stroke();
  }

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
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 2.4;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 2.4;
      const nz = 1;
      const len = Math.sqrt(dx * dx + dy * dy + nz * nz);
      const idx = (y * size + x) * 4;
      normalImage.data[idx] = ((-dx / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 2] = (nz / len) * 255;
      normalImage.data[idx + 3] = 255;
    }
  }
  nctx.putImageData(normalImage, 0, 0);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = 'rgb(120,120,120)';
  rctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const v = 85 + rng() * 95;
    rctx.fillStyle = `rgba(${v},${v},${v},0.45)`;
    rctx.fillRect(0, y, size, 1);
  }
  rctx.strokeStyle = 'rgba(215,215,215,0.45)';
  rctx.lineWidth = 2;
  for (const p of [0, size * 0.25, size * 0.5, size * 0.75, size]) {
    rctx.beginPath();
    rctx.moveTo(p, 0);
    rctx.lineTo(p, size);
    rctx.stroke();
    rctx.beginPath();
    rctx.moveTo(0, p);
    rctx.lineTo(size, p);
    rctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.anisotropy = 8;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 8;
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normalMap, roughnessMap };
}

function setTextureRepeat(tex: ConsoleTextureSet, x: number, y: number) {
  tex.map.repeat.set(x, y);
  tex.normalMap.repeat.set(x, y);
  tex.roughnessMap.repeat.set(x, y);
}

function seedFromId(id: string): number {
  let seed = 17;
  for (let i = 0; i < id.length; i++) {
    seed = Math.imul(seed, 31) + id.charCodeAt(i);
  }
  return seed >>> 0;
}

function createAngledHousingShape(width: number, height: number, depth: number) {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  const shoulderWidth = halfWidth * 0.72;
  const footWidth = halfWidth * 0.46;

  shape.moveTo(-footWidth, 0);
  shape.lineTo(footWidth, 0);
  shape.lineTo(halfWidth, height * 0.58);
  shape.lineTo(shoulderWidth, height);
  shape.lineTo(-shoulderWidth, height);
  shape.lineTo(-halfWidth, height * 0.58);
  shape.lineTo(-footWidth, 0);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  geometry.center();
  return geometry;
}

function addBox(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  rotationX: number = 0,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.x = rotationX;
  group.add(mesh);
  return mesh;
}

function addBoltHeads(
  group: THREE.Group,
  material: THREE.Material,
  corners: THREE.Vector3[],
  rotationX: number,
  radius = 0.014,
) {
  const geometry = new THREE.CylinderGeometry(radius, radius, 0.01, 12);
  for (const corner of corners) {
    const bolt = new THREE.Mesh(geometry, material);
    bolt.position.copy(corner);
    bolt.rotation.x = rotationX;
    group.add(bolt);
  }
}

function addBoltRow(
  group: THREE.Group,
  material: THREE.Material,
  start: THREE.Vector3,
  end: THREE.Vector3,
  count: number,
  rotationX: number,
  radius = 0.011,
) {
  const geometry = new THREE.CylinderGeometry(radius, radius, 0.01, 12);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const position = start.clone().lerp(end, t);
    const matrix = new THREE.Matrix4().makeRotationX(rotationX).setPosition(position);
    mesh.setMatrixAt(i, matrix);
  }
  group.add(mesh);
}

function addFrontPanelPlate(
  group: THREE.Group,
  material: THREE.Material,
  boltMaterial: THREE.Material,
  spec: FacePanelSpec,
  z: number,
  proud = 0.012,
) {
  const plate = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, 0.018), material);
  plate.position.set(spec.x, spec.y, z + proud);
  group.add(plate);

  const inset = 0.028;
  addBoltHeads(
    group,
    boltMaterial,
    [
      new THREE.Vector3(
        spec.x - spec.width / 2 + inset,
        spec.y - spec.height / 2 + inset,
        z + proud + 0.012,
      ),
      new THREE.Vector3(
        spec.x + spec.width / 2 - inset,
        spec.y - spec.height / 2 + inset,
        z + proud + 0.012,
      ),
      new THREE.Vector3(
        spec.x - spec.width / 2 + inset,
        spec.y + spec.height / 2 - inset,
        z + proud + 0.012,
      ),
      new THREE.Vector3(
        spec.x + spec.width / 2 - inset,
        spec.y + spec.height / 2 - inset,
        z + proud + 0.012,
      ),
    ],
    Math.PI / 2,
    0.012,
  );
}

function addDeckPanelPlate(
  group: THREE.Group,
  material: THREE.Material,
  boltMaterial: THREE.Material,
  spec: FacePanelSpec,
  center: THREE.Vector3,
  deckUp: THREE.Vector3,
  rotationX: number,
) {
  const plate = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.018, spec.height), material);
  plate.position
    .copy(center)
    .add(new THREE.Vector3(spec.x, 0, spec.y))
    .addScaledVector(deckUp, 0.018);
  plate.rotation.x = rotationX;
  group.add(plate);

  const inset = 0.03;
  addBoltHeads(
    group,
    boltMaterial,
    [
      new THREE.Vector3(spec.x - spec.width / 2 + inset, 0, spec.y - spec.height / 2 + inset),
      new THREE.Vector3(spec.x + spec.width / 2 - inset, 0, spec.y - spec.height / 2 + inset),
      new THREE.Vector3(spec.x - spec.width / 2 + inset, 0, spec.y + spec.height / 2 - inset),
      new THREE.Vector3(spec.x + spec.width / 2 - inset, 0, spec.y + spec.height / 2 - inset),
    ].map(x => center.clone().add(x).addScaledVector(deckUp, 0.034)),
    rotationX,
    0.011,
  );
}

function addVentBank(
  group: THREE.Group,
  material: THREE.Material,
  cavityMaterial: THREE.Material,
  center: THREE.Vector3,
  slatWidth: number,
  slatCount: number,
  rotationX = 0,
) {
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(slatWidth + 0.08, slatCount * 0.032 + 0.05, 0.054),
    cavityMaterial,
  );
  cavity.position.copy(center).add(new THREE.Vector3(0, 0, -0.028));
  cavity.rotation.x = rotationX;
  group.add(cavity);

  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(slatWidth, 0.012, 0.026), material);
    slat.position.set(center.x, center.y + (i - (slatCount - 1) / 2) * 0.028, center.z);
    slat.rotation.x = rotationX;
    group.add(slat);
  }
}

function addCableRuns(
  group: THREE.Group,
  material: THREE.Material,
  housingWidth: number,
  consoleY: number,
) {
  const cableSpecs = [
    { x: -housingWidth * 0.31, floorX: -housingWidth * 0.44, sag: -0.16, z: -0.44, radius: 0.028 },
    { x: -housingWidth * 0.24, floorX: -housingWidth * 0.36, sag: -0.2, z: -0.53, radius: 0.02 },
    { x: -housingWidth * 0.15, floorX: -housingWidth * 0.21, sag: -0.13, z: -0.47, radius: 0.024 },
    { x: -housingWidth * 0.06, floorX: -housingWidth * 0.09, sag: -0.22, z: -0.58, radius: 0.017 },
    { x: housingWidth * 0.04, floorX: housingWidth * 0.11, sag: -0.14, z: -0.5, radius: 0.022 },
    { x: housingWidth * 0.13, floorX: housingWidth * 0.23, sag: -0.19, z: -0.6, radius: 0.018 },
    { x: housingWidth * 0.22, floorX: housingWidth * 0.34, sag: -0.17, z: -0.49, radius: 0.025 },
    { x: housingWidth * 0.32, floorX: housingWidth * 0.47, sag: -0.24, z: -0.56, radius: 0.019 },
    { x: housingWidth * 0.39, floorX: housingWidth * 0.54, sag: -0.12, z: -0.42, radius: 0.015 },
  ];
  for (const spec of cableSpecs) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(spec.x, -0.47, -0.28),
      new THREE.Vector3(spec.x * 0.96, -0.7 + spec.sag, spec.z),
      new THREE.Vector3(spec.floorX * 0.9, -consoleY + 0.11, spec.z - 0.05),
      new THREE.Vector3(spec.floorX * 1.08, -consoleY + 0.018, -0.24),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, spec.radius, 8), material);
    group.add(cable);
  }
}

function addStatusLightStrip(
  group: THREE.Group,
  themeColor: number,
  origin: THREE.Vector3,
  normal: THREE.Vector3,
) {
  const geometry = new THREE.BoxGeometry(0.034, 0.018, 0.018);
  const batches = [
    { color: themeColor, x: [-0.22, -0.06, 0.18] },
    { color: 0xffb454, x: [-0.14, 0.1] },
    { color: 0x78f0a4, x: [-0.3, 0.02, 0.26] },
  ];

  for (const batch of batches) {
    const material = new THREE.MeshStandardMaterial({
      color: batch.color,
      emissive: batch.color,
      emissiveIntensity: 0.48,
      metalness: 0.05,
      roughness: 0.28,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, batch.x.length);
    for (let i = 0; i < batch.x.length; i++) {
      const position = origin.clone().add(new THREE.Vector3(batch.x[i]!, 0, 0));
      position.addScaledVector(normal, 0.018);
      const matrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
      mesh.setMatrixAt(i, matrix);
    }
    group.add(mesh);
  }
}

export function createConsole(definition: ConsoleDefinition) {
  const group = new THREE.Group();
  group.position.copy(definition.position);
  group.rotation.y = definition.rotationY;

  const screenHandles: {
    app?: { unmount(): void };
    disposeIframe?: () => void;
    dispose?: () => void;
  }[] = [];
  const panelHitTargets: PanelHitTarget[] = [];
  const screenFrames: ScreenFrameSpec[] = [];

  // ---- Top row: this console's buffer screens, centered above the desk. ----
  const screenScale = SCREEN_SCALE * TOP_SCREEN_SCALE_BOOST;
  const screenWidths = definition.screens.map(s => s.widthPx * screenScale);
  const topRowWidth =
    sumBy(screenWidths, x => x) + Math.max(0, definition.screens.length - 1) * SCREEN_GAP;
  const deckUp = new THREE.Vector3(0, Math.cos(DESK_TILT), Math.sin(DESK_TILT));
  const deckSurfaceCenter = DESKTOP_CENTER.clone().addScaledVector(
    deckUp,
    DESKTOP_THICKNESS / 2 + DESKTOP_SURFACE_CLEARANCE,
  );
  const deckRearEdge = deckSurfaceCenter.clone().add(new THREE.Vector3(0, 0, -DESKTOP_DEPTH / 2));
  const screenBaseEdge = deckRearEdge.clone().add(new THREE.Vector3(0, 0, TOP_SCREEN_REAR_OFFSET));

  let cursorX = -topRowWidth / 2;
  let maxHeightWorld = 0;

  for (let i = 0; i < definition.screens.length; i++) {
    const screen = definition.screens[i]!;
    const command = screen.command;
    const descriptor = xit.get(command);
    if (descriptor === undefined) {
      throw new Error(`Unknown XIT command in console roster: ${command}`);
    }

    const maxHeightPx = Math.round(SCREEN_MAX_HEIGHT_WORLD / SCREEN_SCALE);
    const { root, targetDiv, object } = createPanelShell(
      screen.widthPx,
      screen.heightPx,
      maxHeightPx,
    );
    const ScreenComponent = descriptor.component([]);
    const app = createFragmentApp(() => h(Teleport, { to: targetDiv }, [h(ScreenComponent)])).use(
      tileStatePlugin,
      { tile: `game-3d-${definition.id}-${command}` },
    );
    app.appendTo(document.body);
    const disposeIframe = attachIframeRepaintWorkaround(root, targetDiv);
    screenHandles.push({ app, disposeIframe });

    const heightPx = screen.heightPx ?? 400;
    const heightWorld = heightPx * screenScale;
    const widthWorld = screenWidths[i]!;
    object.scale.setScalar(screenScale);
    const screenBottomToCenter = new THREE.Vector3(
      0,
      (heightWorld / 2) * Math.cos(SCREEN_BACK_TILT),
      (heightWorld / 2) * Math.sin(SCREEN_BACK_TILT),
    );
    object.position
      .copy(screenBaseEdge)
      .add(new THREE.Vector3(SCREEN_STACK_X_OFFSET + cursorX + widthWorld / 2, 0.02, 0))
      .add(screenBottomToCenter);
    if (definition.screens.length > 1 && i === 1) {
      object.position.z += SCREEN_STACK_DEPTH_STAGGER;
    }
    object.rotation.x = SCREEN_BACK_TILT;
    cursorX += widthWorld + SCREEN_GAP;
    group.add(object);
    screenFrames.push({
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      width: widthWorld,
      height: heightWorld,
    });

    const hitPlane = createPanelHitPlane(root, screen.widthPx, heightPx, widthWorld, heightWorld);
    hitPlane.mesh.position.copy(object.position);
    hitPlane.mesh.rotation.copy(object.rotation);
    group.add(hitPlane.mesh);
    panelHitTargets.push(hitPlane);

    if (heightWorld > maxHeightWorld) {
      maxHeightWorld = heightWorld;
    }
  }

  const controlSurfacePanels = createControlSurfacePanels(definition.themeColor);
  const controlPanelWidthWorld = CONTROL_SURFACE_WIDTH_PX * SCREEN_SCALE;
  const controlRowWidth = 2 * controlPanelWidthWorld + SCREEN_GAP;
  const housingWidth = Math.max(topRowWidth, controlRowWidth) + 0.55;
  // Matches console-roster.ts; local so we don't create a circular import.
  const CONSOLE_Y = ROOM_HEIGHT * 0.55 * 0.7;
  const housingHeight = CONSOLE_Y + maxHeightWorld + 0.2;

  // Stops at desk height instead of growing into the control surface.
  const pedestalHeight = CONSOLE_Y - 0.4;
  const baseSeed = seedFromId(definition.id);
  const pedestalTex = createConsoleMetalTextures(baseSeed, [48, 58, 68]);
  const deckTex = createConsoleMetalTextures(baseSeed + 11, [35, 44, 53]);
  const bezelTex = createConsoleMetalTextures(baseSeed + 23, [12, 17, 24]);
  setTextureRepeat(pedestalTex, 0.9, 1.4);
  setTextureRepeat(deckTex, 2.8, 1.4);
  setTextureRepeat(bezelTex, 1.2, 1.2);
  const consoleNormalScale = new THREE.Vector2(0.38, 0.38);
  const housingMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f3a45,
    map: pedestalTex.map,
    normalMap: pedestalTex.normalMap,
    normalScale: consoleNormalScale,
    roughnessMap: pedestalTex.roughnessMap,
    metalness: 0.72,
    roughness: 0.56,
  });
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1218,
    map: bezelTex.map,
    normalMap: bezelTex.normalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: bezelTex.roughnessMap,
    metalness: 0.9,
    roughness: 0.38,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x66717a,
    metalness: 0.93,
    roughness: 0.28,
  });
  const grooveMaterial = new THREE.MeshStandardMaterial({
    color: 0x05080c,
    metalness: 0.45,
    roughness: 0.62,
  });
  const themeTrimMaterial = new THREE.MeshStandardMaterial({
    color: definition.themeColor,
    emissive: definition.themeColor,
    emissiveIntensity: 0.21,
    metalness: 0.38,
    roughness: 0.36,
  });
  const panelPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0x27323c,
    map: deckTex.map,
    normalMap: deckTex.normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: deckTex.roughnessMap,
    metalness: 0.78,
    roughness: 0.48,
  });
  const boltMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f8991,
    metalness: 0.96,
    roughness: 0.3,
  });
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x05070a,
    metalness: 0.08,
    roughness: 0.72,
  });
  const lowerModuleHeight = pedestalHeight * 0.32;
  const midModuleHeight = pedestalHeight * 0.44;
  const upperModuleHeight = pedestalHeight * 0.2;
  const moduleGap = 0.035;
  const lowerModuleY = -CONSOLE_Y + 0.18 + lowerModuleHeight / 2;
  const midModuleY = lowerModuleY + lowerModuleHeight / 2 + moduleGap + midModuleHeight / 2;
  const upperModuleY = midModuleY + midModuleHeight / 2 + moduleGap + upperModuleHeight / 2;

  const lowerModule = new THREE.Mesh(
    createAngledHousingShape(housingWidth * 0.68, lowerModuleHeight, 0.4),
    housingMaterial,
  );
  lowerModule.position.set(0, lowerModuleY, -0.16);
  group.add(lowerModule);

  const midModule = new THREE.Mesh(
    createAngledHousingShape(housingWidth * 0.58, midModuleHeight, 0.34),
    housingMaterial,
  );
  midModule.position.set(0, midModuleY, -0.18);
  group.add(midModule);

  const upperCollar = new THREE.Mesh(
    createAngledHousingShape(housingWidth * 0.74, upperModuleHeight, 0.46),
    baseMaterial,
  );
  upperCollar.position.set(0, upperModuleY, -0.1);
  group.add(upperCollar);

  for (const y of [
    lowerModuleY + lowerModuleHeight / 2 + moduleGap / 2,
    midModuleY + midModuleHeight / 2 + moduleGap / 2,
  ]) {
    addBox(
      group,
      new THREE.BoxGeometry(housingWidth * 0.72, moduleGap, 0.05),
      grooveMaterial,
      new THREE.Vector3(0, y, 0.05),
    );
  }

  addBox(
    group,
    new THREE.CylinderGeometry(housingWidth * 0.34, housingWidth * 0.44, 0.16, 12),
    baseMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + 0.08, 0.16),
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.82, 0.12, 0.5),
    baseMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + 0.19, 0.05),
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.48, 0.16, 0.48),
    baseMaterial,
    new THREE.Vector3(0, DESKTOP_CENTER.y - 0.17, -0.04),
    DESK_TILT * 0.35,
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.5, 0.045, 0.035),
    grooveMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + pedestalHeight * 0.42, 0.004),
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.42, 0.026, 0.04),
    grooveMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + pedestalHeight * 0.68, 0.012),
  );
  for (const x of [-housingWidth * 0.33, -housingWidth * 0.03, housingWidth * 0.2]) {
    addBox(
      group,
      new THREE.BoxGeometry(0.045, pedestalHeight * 0.58, 0.04),
      grooveMaterial,
      new THREE.Vector3(x, -CONSOLE_Y + pedestalHeight * 0.48, 0.018),
    );
  }
  const frontPanelY = -CONSOLE_Y + pedestalHeight * 0.38;
  const upperPanelY = -CONSOLE_Y + pedestalHeight * 0.66;
  for (const spec of [
    { x: -housingWidth * 0.26, y: frontPanelY - 0.02, width: housingWidth * 0.34, height: 0.31 },
    { x: housingWidth * 0.05, y: frontPanelY + 0.04, width: housingWidth * 0.18, height: 0.42 },
    { x: housingWidth * 0.29, y: frontPanelY - 0.04, width: housingWidth * 0.22, height: 0.24 },
    { x: -housingWidth * 0.16, y: upperPanelY + 0.01, width: housingWidth * 0.22, height: 0.18 },
    { x: housingWidth * 0.18, y: upperPanelY - 0.02, width: housingWidth * 0.3, height: 0.15 },
  ]) {
    addFrontPanelPlate(group, panelPlateMaterial, boltMaterial, spec, 0.032);
  }
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.2, 0.24, 0.18),
    baseMaterial,
    new THREE.Vector3(housingWidth * 0.22, frontPanelY - 0.02, 0.16),
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.12, 0.032, 0.04),
    trimMaterial,
    new THREE.Vector3(-housingWidth * 0.27, frontPanelY + 0.03, 0.068),
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.06, 0.08, 0.045),
    trimMaterial,
    new THREE.Vector3(housingWidth * 0.04, frontPanelY + 0.19, 0.066),
  );
  for (const spec of [
    { x: -housingWidth * 0.29, y: -CONSOLE_Y + 0.12, width: housingWidth * 0.18, height: 0.1 },
    { x: -housingWidth * 0.03, y: -CONSOLE_Y + 0.14, width: housingWidth * 0.22, height: 0.11 },
    { x: housingWidth * 0.25, y: -CONSOLE_Y + 0.115, width: housingWidth * 0.15, height: 0.12 },
  ]) {
    addFrontPanelPlate(group, panelPlateMaterial, boltMaterial, spec, 0.24, 0.01);
  }
  addVentBank(
    group,
    trimMaterial,
    grooveMaterial,
    new THREE.Vector3(-housingWidth * 0.29, -CONSOLE_Y + pedestalHeight * 0.52, 0.064),
    0.22,
    7,
  );
  addVentBank(
    group,
    trimMaterial,
    grooveMaterial,
    new THREE.Vector3(housingWidth * 0.29, -CONSOLE_Y + pedestalHeight * 0.52, 0.064),
    0.22,
    7,
  );
  addVentBank(
    group,
    trimMaterial,
    grooveMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + 0.2, 0.282),
    0.36,
    5,
  );
  addVentBank(
    group,
    trimMaterial,
    grooveMaterial,
    new THREE.Vector3(-housingWidth * 0.16, upperPanelY + 0.01, 0.078),
    0.18,
    5,
  );
  addVentBank(
    group,
    trimMaterial,
    grooveMaterial,
    new THREE.Vector3(housingWidth * 0.2, upperPanelY - 0.02, 0.078),
    0.24,
    4,
  );
  addBox(
    group,
    new THREE.BoxGeometry(housingWidth * 0.68, 0.022, 0.026),
    trimMaterial,
    new THREE.Vector3(0, -CONSOLE_Y + pedestalHeight - 0.02, 0.04),
  );
  for (const x of [-(housingWidth * 0.31), housingWidth * 0.31]) {
    addBox(
      group,
      new THREE.BoxGeometry(0.026, pedestalHeight * 0.88, 0.024),
      trimMaterial,
      new THREE.Vector3(x, -CONSOLE_Y + pedestalHeight * 0.48, 0.052),
    );
  }
  addCableRuns(group, cableMaterial, housingWidth, CONSOLE_Y);
  addBoltRow(
    group,
    boltMaterial,
    new THREE.Vector3(-housingWidth * 0.32, lowerModuleY + lowerModuleHeight / 2 + 0.012, 0.075),
    new THREE.Vector3(housingWidth * 0.32, lowerModuleY + lowerModuleHeight / 2 + 0.012, 0.075),
    8,
    Math.PI / 2,
  );
  addBoltRow(
    group,
    boltMaterial,
    new THREE.Vector3(-housingWidth * 0.28, midModuleY + midModuleHeight / 2 + 0.012, 0.075),
    new THREE.Vector3(housingWidth * 0.28, midModuleY + midModuleHeight / 2 + 0.012, 0.075),
    7,
    Math.PI / 2,
  );
  addBoltRow(
    group,
    boltMaterial,
    new THREE.Vector3(-housingWidth * 0.32, upperModuleY - upperModuleHeight / 2 - 0.012, 0.08),
    new THREE.Vector3(housingWidth * 0.32, upperModuleY - upperModuleHeight / 2 - 0.012, 0.08),
    8,
    Math.PI / 2,
  );
  addBoltRow(
    group,
    boltMaterial,
    new THREE.Vector3(-housingWidth * 0.36, -CONSOLE_Y + 0.18, 0.23),
    new THREE.Vector3(housingWidth * 0.36, -CONSOLE_Y + 0.18, 0.23),
    6,
    Math.PI / 2,
  );
  addStatusLightStrip(
    group,
    definition.themeColor,
    new THREE.Vector3(0, -CONSOLE_Y + pedestalHeight * 0.55, 0.025),
    new THREE.Vector3(0, 0, 1),
  );

  const pedestalAccent = new THREE.Mesh(
    new THREE.BoxGeometry(housingWidth * 0.34, 0.025, 0.014),
    themeTrimMaterial,
  );
  pedestalAccent.position.set(0, -CONSOLE_Y + pedestalHeight * 0.58, -0.355);
  group.add(pedestalAccent);

  const controlPanelHeightWorld = CONTROL_SURFACE_HEIGHT_PX * SCREEN_SCALE;
  const controlOffsetX = controlPanelWidthWorld / 2 + SCREEN_GAP / 2;
  const desktopWidth = Math.max(housingWidth * 0.85, controlRowWidth + 0.36);
  const controlRowCenter = deckSurfaceCenter.clone().addScaledVector(deckUp, 0.018);
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(desktopWidth, DESKTOP_THICKNESS, DESKTOP_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x222c35,
      map: deckTex.map,
      normalMap: deckTex.normalMap,
      normalScale: consoleNormalScale,
      roughnessMap: deckTex.roughnessMap,
      metalness: 0.88,
      roughness: 0.44,
    }),
  );
  desk.position.copy(DESKTOP_CENTER);
  desk.rotation.x = DESK_TILT;
  group.add(desk);

  for (const spec of [
    { x: -desktopWidth * 0.26, y: -DESKTOP_DEPTH * 0.12, width: desktopWidth * 0.22, height: 0.16 },
    { x: 0, y: -DESKTOP_DEPTH * 0.12, width: desktopWidth * 0.22, height: 0.16 },
    { x: desktopWidth * 0.26, y: -DESKTOP_DEPTH * 0.12, width: desktopWidth * 0.22, height: 0.16 },
    { x: -desktopWidth * 0.16, y: DESKTOP_DEPTH * 0.24, width: desktopWidth * 0.16, height: 0.11 },
    { x: desktopWidth * 0.16, y: DESKTOP_DEPTH * 0.24, width: desktopWidth * 0.16, height: 0.11 },
  ]) {
    addDeckPanelPlate(
      group,
      panelPlateMaterial,
      boltMaterial,
      spec,
      deckSurfaceCenter,
      deckUp,
      DESK_TILT,
    );
  }
  for (const x of [-desktopWidth * 0.4, desktopWidth * 0.4]) {
    const ventCenter = deckSurfaceCenter
      .clone()
      .add(new THREE.Vector3(x, 0, DESKTOP_DEPTH * 0.18))
      .addScaledVector(deckUp, 0.032);
    for (let i = 0; i < 6; i++) {
      addBox(
        group,
        new THREE.BoxGeometry(0.16, 0.01, 0.018),
        grooveMaterial,
        ventCenter.clone().add(new THREE.Vector3(0, 0, (i - 2.5) * 0.028)),
        DESK_TILT,
      );
    }
  }
  for (const z of [-(DESKTOP_DEPTH / 2 + 0.03), DESKTOP_DEPTH / 2 + 0.03]) {
    addBox(
      group,
      new THREE.BoxGeometry(desktopWidth + 0.14, 0.026, 0.03),
      trimMaterial,
      deckSurfaceCenter
        .clone()
        .add(new THREE.Vector3(0, 0, z))
        .addScaledVector(deckUp, 0.036),
      DESK_TILT,
    );
  }

  for (const x of [-(desktopWidth / 2 + 0.04), desktopWidth / 2 + 0.04]) {
    addBox(
      group,
      new THREE.BoxGeometry(0.12, 0.14, DESKTOP_DEPTH + 0.12),
      baseMaterial,
      new THREE.Vector3(x, DESKTOP_CENTER.y - 0.005, DESKTOP_CENTER.z),
      DESK_TILT,
    );
    addBox(
      group,
      new THREE.BoxGeometry(0.045, 0.34, 0.1),
      trimMaterial,
      new THREE.Vector3(x * 0.96, DESKTOP_CENTER.y - 0.19, DESKTOP_CENTER.z - 0.16),
      DESK_TILT * 0.25,
    );
  }
  addBox(
    group,
    new THREE.BoxGeometry(desktopWidth + 0.12, 0.08, 0.08),
    baseMaterial,
    new THREE.Vector3(0, DESKTOP_CENTER.y - 0.01, DESKTOP_CENTER.z + DESKTOP_DEPTH / 2 + 0.015),
    DESK_TILT,
  );
  const bezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x090f16,
    map: bezelTex.map,
    normalMap: bezelTex.normalMap,
    normalScale: consoleNormalScale,
    roughnessMap: bezelTex.roughnessMap,
    metalness: 0.82,
    roughness: 0.46,
  });

  const hingeHeight = 0.07;
  const hingeDepth = 0.075;
  const screenBottomY = screenBaseEdge.y + 0.02;
  const rearSupportSideInset = Math.min(SCREEN_GAP, topRowWidth * 0.12);
  const hingeWidth = Math.max(0.2, topRowWidth - rearSupportSideInset * 2);
  const spineWidth = Math.max(0.2, hingeWidth - rearSupportSideInset * 2);
  const originalHingeY = screenBottomY - hingeHeight / 2 - 0.02;
  const hingeY = deckRearEdge.y + (originalHingeY - deckRearEdge.y) * 0.5;
  const hingeZ = deckRearEdge.z - 0.02;
  const hingeBar = new THREE.Mesh(
    new THREE.BoxGeometry(hingeWidth, hingeHeight, hingeDepth),
    bezelMaterial,
  );
  hingeBar.position.set(SCREEN_STACK_X_OFFSET, hingeY, hingeZ);
  hingeBar.rotation.x = DESK_TILT;
  group.add(hingeBar);

  const spineHeight = Math.max(0.02, screenBottomY - hingeY);
  const spineDepth = Math.abs(screenBaseEdge.z - hingeZ) + 0.12;
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(spineWidth, spineHeight, spineDepth),
    bezelMaterial,
  );
  spine.position.set(
    SCREEN_STACK_X_OFFSET,
    hingeY + spineHeight / 2,
    (hingeZ + screenBaseEdge.z) / 2,
  );
  spine.rotation.x = SCREEN_BACK_TILT * 0.45;
  group.add(spine);

  for (const frame of screenFrames) {
    for (const x of [-(frame.width / 2 + 0.12), frame.width / 2 + 0.12]) {
      const armStart = new THREE.Vector3(SCREEN_STACK_X_OFFSET + x, hingeY + 0.035, hingeZ - 0.03);
      const armEnd = new THREE.Vector3(
        frame.position.x + x * 0.72,
        frame.position.y - frame.height * 0.28,
        frame.position.z - 0.14,
      );
      const hingeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.1), trimMaterial);
      hingeSocket.position.copy(armStart);
      hingeSocket.rotation.x = DESK_TILT;
      group.add(hingeSocket);

      const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.09), trimMaterial);
      clevis.position.copy(armEnd);
      clevis.rotation.copy(frame.rotation);
      group.add(clevis);
    }
  }

  const buttonRowCenter = DESKTOP_CENTER.clone()
    .add(new THREE.Vector3(0, 0, DESKTOP_DEPTH / 2 - 0.055))
    .addScaledVector(deckUp, DESKTOP_THICKNESS / 2 + DESKTOP_SURFACE_CLEARANCE + 0.018);
  const buttonRotationX = DESK_TILT;
  const buttonBezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x08111b,
    map: bezelTex.map,
    normalMap: bezelTex.normalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: bezelTex.roughnessMap,
    emissive: definition.themeColor,
    emissiveIntensity: 0.06,
    metalness: 0.78,
    roughness: 0.36,
  });
  const createButton = (x: number, material: THREE.Material) => {
    const position = buttonRowCenter.clone().add(new THREE.Vector3(x, 0, 0));
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.045, 0.018, 40),
      buttonBezelMaterial,
    );
    bezel.position.copy(position).addScaledVector(deckUp, -0.006);
    bezel.rotation.x = buttonRotationX;
    group.add(bezel);

    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.04, 40), material);
    button.position.copy(position).addScaledVector(deckUp, 0.018);
    button.rotation.x = buttonRotationX;
    group.add(button);
  };

  createButton(
    -0.052,
    new THREE.MeshStandardMaterial({
      color: 0xdd2222,
      emissive: 0xdd2222,
      emissiveIntensity: 0.4,
      metalness: 0.2,
      roughness: 0.45,
    }),
  );

  createButton(
    0.052,
    new THREE.MeshStandardMaterial({
      color: 0xb8b8b8,
      emissive: 0x666666,
      emissiveIntensity: 0.09,
      metalness: 0.28,
      roughness: 0.42,
    }),
  );

  for (const x of [-0.19, 0.19]) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.04, 0.044, 32),
      new THREE.MeshStandardMaterial({
        color: 0x070b10,
        metalness: 0.7,
        roughness: 0.32,
      }),
    );
    knob.position
      .copy(buttonRowCenter)
      .add(new THREE.Vector3(x, 0, 0))
      .addScaledVector(deckUp, 0.02);
    knob.rotation.x = buttonRotationX;
    group.add(knob);

    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, 0.038), themeTrimMaterial);
    marker.position.copy(knob.position).addScaledVector(deckUp, 0.025);
    marker.rotation.x = buttonRotationX;
    group.add(marker);
  }

  for (const x of [-controlOffsetX, controlOffsetX]) {
    const well = controlRowCenter.clone().add(new THREE.Vector3(x, 0, 0));
    addBox(
      group,
      new THREE.BoxGeometry(controlPanelWidthWorld + 0.12, 0.026, controlPanelHeightWorld + 0.11),
      grooveMaterial,
      well.clone().addScaledVector(deckUp, -0.026),
      DESK_TILT,
    );
    for (const z of [-(controlPanelHeightWorld / 2 + 0.065), controlPanelHeightWorld / 2 + 0.065]) {
      addBox(
        group,
        new THREE.BoxGeometry(controlPanelWidthWorld + 0.2, 0.034, 0.045),
        trimMaterial,
        well
          .clone()
          .add(new THREE.Vector3(0, 0, z))
          .addScaledVector(deckUp, 0.006),
        DESK_TILT,
      );
    }
  }

  // +0.02 avoids z-fighting with the room floor.
  const floorMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 48),
    new THREE.MeshStandardMaterial({
      color: 0x111820,
      map: bezelTex.map,
      normalMap: bezelTex.normalMap,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: bezelTex.roughnessMap,
      roughness: 0.5,
      metalness: 0.72,
    }),
  );
  floorMarker.rotation.x = -Math.PI / 2;
  floorMarker.position.set(0, -CONSOLE_Y + 0.02, 0.3);
  group.add(floorMarker);

  const accentLight = new THREE.PointLight(definition.themeColor, 0.09, 1.8);
  accentLight.position.set(0, 0.18, 0.72);
  group.add(accentLight);

  // ---- Desk row: two control-surface panels for the split ExecuteActionPackage window
  // (Node.child primary + companion buffer), flush-mounted into the thin desktop slab.
  for (const { slot, position } of [
    {
      slot: controlSurfacePanels.primary,
      position: controlRowCenter.clone().add(new THREE.Vector3(-controlOffsetX, 0, 0)),
    },
    {
      slot: controlSurfacePanels.companion,
      position: controlRowCenter.clone().add(new THREE.Vector3(controlOffsetX, 0, 0)),
    },
  ]) {
    slot.object.position.copy(position);
    slot.object.rotation.x = -Math.PI / 2 + DESK_TILT;
    group.add(slot.object);
    screenHandles.push({ dispose: slot.dispose });

    const hitPlane = createPanelHitPlane(
      slot.root,
      CONTROL_SURFACE_WIDTH_PX,
      CONTROL_SURFACE_HEIGHT_PX,
      controlPanelWidthWorld,
      controlPanelHeightWorld,
    );
    hitPlane.mesh.position.copy(slot.object.position);
    hitPlane.mesh.rotation.copy(slot.object.rotation);
    group.add(hitPlane.mesh);
    panelHitTargets.push(hitPlane);
  }

  // Invisible hitbox for raycasting — separate from housing so visual redesigns never
  // touch interaction code.
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(housingWidth, housingHeight, 0.6));
  hitbox.visible = false;
  hitbox.position.set(0, 0, -0.05);
  hitbox.userData.consoleId = definition.id;
  group.add(hitbox);

  const dispose = () => {
    for (const handle of screenHandles) {
      handle.disposeIframe?.();
      handle.app?.unmount();
      handle.dispose?.();
    }
  };

  return { definition, group, hitbox, controlSurfacePanels, panelHitTargets, dispose };
}

export type Console = ReturnType<typeof createConsole>;
