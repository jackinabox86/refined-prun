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
const TOP_SCREEN_SCALE_BOOST = 1.4;
/** Extra rearward set-back from the desktop rear edge for the top screen row. */
const TOP_SCREEN_REAR_OFFSET = -0.32;
/** Center of the thin desktop slab that carries the control-surface panels. */
const DESKTOP_CENTER = new THREE.Vector3(0, -0.42, 0.16);
const DESKTOP_THICKNESS = 0.1;
const DESKTOP_DEPTH = 0.54;
const DESKTOP_SURFACE_CLEARANCE = 0.012;

interface ConsoleTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
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
      .add(new THREE.Vector3(cursorX + widthWorld / 2, 0.02, 0))
      .add(screenBottomToCenter);
    object.rotation.x = SCREEN_BACK_TILT;
    cursorX += widthWorld + SCREEN_GAP;
    group.add(object);

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
  const pedestalTex = createConsoleMetalTextures(baseSeed, [82, 94, 108]);
  const deckTex = createConsoleMetalTextures(baseSeed + 11, [51, 61, 71]);
  const bezelTex = createConsoleMetalTextures(baseSeed + 23, [17, 24, 32]);
  setTextureRepeat(pedestalTex, 0.9, 1.4);
  setTextureRepeat(deckTex, 2.8, 1.4);
  setTextureRepeat(bezelTex, 1.2, 1.2);
  const consoleNormalScale = new THREE.Vector2(0.38, 0.38);
  const housingMaterial = new THREE.MeshStandardMaterial({
    color: 0x526070,
    map: pedestalTex.map,
    normalMap: pedestalTex.normalMap,
    normalScale: consoleNormalScale,
    roughnessMap: pedestalTex.roughnessMap,
    metalness: 0.85,
    roughness: 0.38,
  });
  const pedestal = new THREE.Mesh(
    createAngledHousingShape(housingWidth * 0.62, pedestalHeight, 0.34),
    housingMaterial,
  );
  pedestal.position.set(0, -CONSOLE_Y + pedestalHeight / 2, -0.18);
  group.add(pedestal);

  const pedestalAccent = new THREE.Mesh(
    new THREE.BoxGeometry(housingWidth * 0.34, 0.025, 0.014),
    new THREE.MeshStandardMaterial({
      color: definition.themeColor,
      emissive: definition.themeColor,
      emissiveIntensity: 0.34,
      metalness: 0.35,
      roughness: 0.42,
    }),
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
      color: 0x333d47,
      map: deckTex.map,
      normalMap: deckTex.normalMap,
      normalScale: consoleNormalScale,
      roughnessMap: deckTex.roughnessMap,
      metalness: 0.88,
      roughness: 0.34,
    }),
  );
  desk.position.copy(DESKTOP_CENTER);
  desk.rotation.x = DESK_TILT;
  group.add(desk);

  const bezelMaterial = new THREE.MeshStandardMaterial({
    color: 0x111820,
    map: bezelTex.map,
    normalMap: bezelTex.normalMap,
    normalScale: consoleNormalScale,
    roughnessMap: bezelTex.roughnessMap,
    metalness: 0.82,
    roughness: 0.36,
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
  hingeBar.position.set(0, hingeY, hingeZ);
  hingeBar.rotation.x = DESK_TILT;
  group.add(hingeBar);

  const spineHeight = Math.max(0.02, screenBottomY - hingeY);
  const spineDepth = Math.abs(screenBaseEdge.z - hingeZ) + 0.12;
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(spineWidth, spineHeight, spineDepth),
    bezelMaterial,
  );
  spine.position.set(0, hingeY + spineHeight / 2, (hingeZ + screenBaseEdge.z) / 2);
  spine.rotation.x = SCREEN_BACK_TILT * 0.45;
  group.add(spine);

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
    emissiveIntensity: 0.12,
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
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.45,
    }),
  );

  createButton(
    0.052,
    new THREE.MeshStandardMaterial({
      color: 0xb8b8b8,
      emissive: 0x666666,
      emissiveIntensity: 0.18,
      metalness: 0.28,
      roughness: 0.42,
    }),
  );

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

  const accentLight = new THREE.PointLight(definition.themeColor, 0.18, 1.8);
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
