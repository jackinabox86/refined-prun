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

/** Canvas size for all generated surface textures. */
const TEX_SIZE = 512;

/** Sparse status-LED accent colors (amber/green/red), scattered onto wall panels. */
const LED_COLORS: Array<[number, number, number]> = [
  [255, 176, 64],
  [86, 255, 150],
  [255, 90, 90],
];

/** Deterministic PRNG (mulberry32) so a given seed always reproduces the same texture. */
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

interface Grime {
  x: number;
  y: number;
  r: number;
}

interface Scratch {
  x: number;
  y: number;
  len: number;
  ang: number;
  light: boolean;
}

interface Led {
  col: number;
  row: number;
  color: [number, number, number];
}

interface SurfaceOptions {
  /** PRNG seed — different seeds give different-looking panel layouts for the same params. */
  seed: number;
  cols: number;
  rows: number;
  baseColor: [number, number, number];
  /** Per-panel brightness jitter (0..1ish) so panels aren't a single flat repeated tile. */
  jitter: number;
  grimeCount: number;
  scratchCount: number;
  rivets: boolean;
  /** Fraction (0..1) of the tile height where a painted/glowing accent band sits. */
  accentRowFrac?: number;
  accentColor?: [number, number, number];
  /** Sparse emissive status-LED count scattered across panels. */
  ledCount?: number;
}

interface SurfaceTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap?: THREE.CanvasTexture;
}

/**
 * Builds a matched {map, normalMap, roughnessMap, emissiveMap} set for one repeating
 * surface tile: a panel grid with per-panel brightness/wear variation, corner rivets,
 * grime blotches, scratches, and an optional painted+glowing accent band / status LEDs.
 * All four maps are derived from a single randomized "recipe" computed once up front so
 * grime/scratches/rivets land in the same places across color, bump, and roughness.
 */
function createSurfaceTextureSet(opts: SurfaceOptions): SurfaceTextureSet {
  const { cols, rows } = opts;
  const cellW = TEX_SIZE / cols;
  const cellH = TEX_SIZE / rows;
  const rng = mulberry32(opts.seed);

  // --- Recipe: all randomness resolved up front, then reused across every canvas. ---
  const brightness: number[][] = [];
  const wear: number[][] = [];
  const rivetOn: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const bRow: number[] = [];
    const wRow: number[] = [];
    const rRow: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      bRow.push(1 + (rng() - 0.5) * opts.jitter);
      wRow.push(rng());
      rRow.push(rng() < 0.75);
    }
    brightness.push(bRow);
    wear.push(wRow);
    rivetOn.push(rRow);
  }
  const grimeSpots: Grime[] = Array.from({ length: opts.grimeCount }, () => ({
    x: rng() * TEX_SIZE,
    y: rng() * TEX_SIZE,
    r: 10 + rng() * 26,
  }));
  const scratches: Scratch[] = Array.from({ length: opts.scratchCount }, () => ({
    x: rng() * TEX_SIZE,
    y: rng() * TEX_SIZE,
    len: 8 + rng() * 22,
    ang: rng() * Math.PI * 2,
    light: rng() < 0.5,
  }));
  const leds: Led[] =
    opts.ledCount !== undefined && opts.ledCount > 0
      ? Array.from({ length: opts.ledCount }, () => ({
          col: Math.floor(rng() * cols),
          row: Math.floor(rng() * rows),
          color: LED_COLORS[Math.floor(rng() * LED_COLORS.length)]!,
        }))
      : [];
  const accentH = cellH * 0.4;
  const accentY =
    opts.accentRowFrac !== undefined ? opts.accentRowFrac * TEX_SIZE - accentH / 2 : 0;

  const drawGrid = (ctx: CanvasRenderingContext2D, minorStyle: string, majorStyle: string) => {
    ctx.strokeStyle = minorStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      const x = i * cellW;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TEX_SIZE);
    }
    for (let i = 0; i <= rows; i++) {
      const y = i * cellH;
      ctx.moveTo(0, y);
      ctx.lineTo(TEX_SIZE, y);
    }
    ctx.stroke();

    ctx.strokeStyle = majorStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= cols; i += 4) {
      const x = i * cellW;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TEX_SIZE);
    }
    for (let i = 0; i <= rows; i += 4) {
      const y = i * cellH;
      ctx.moveTo(0, y);
      ctx.lineTo(TEX_SIZE, y);
    }
    ctx.stroke();
  };

  // --- Color map ---
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const f = brightness[r]![c]!;
      const [br, bg, bb] = opts.baseColor;
      ctx.fillStyle = `rgb(${clamp255(br * f)},${clamp255(bg * f)},${clamp255(bb * f)})`;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    }
  }
  drawGrid(ctx, 'rgba(10,14,18,0.4)', 'rgba(6,8,10,0.65)');

  if (opts.rivets) {
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        if (!rivetOn[r]![c]) {
          continue;
        }
        const x = c * cellW;
        const y = r * cellH;
        ctx.fillStyle = 'rgba(8,10,12,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x - 0.6, y - 0.6, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (const g of grimeSpots) {
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    grad.addColorStop(0, 'rgba(10,10,8,0.22)');
    grad.addColorStop(1, 'rgba(10,10,8,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 1;
  for (const s of scratches) {
    const dx = Math.cos(s.ang) * s.len;
    const dy = Math.sin(s.ang) * s.len;
    ctx.strokeStyle = s.light ? 'rgba(255,255,255,0.22)' : 'rgba(15,15,18,0.3)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + dx, s.y + dy);
    ctx.stroke();
  }

  if (opts.accentRowFrac !== undefined && opts.accentColor) {
    const [ar, ag, ab] = opts.accentColor;
    ctx.fillStyle = `rgb(${clamp255(ar * 0.65)},${clamp255(ag * 0.65)},${clamp255(ab * 0.65)})`;
    ctx.fillRect(0, accentY, TEX_SIZE, accentH);
    ctx.strokeStyle = 'rgba(10,10,10,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, accentY, TEX_SIZE, accentH);
  }

  for (const led of leds) {
    const x = led.col * cellW + cellW * 0.5;
    const y = led.row * cellH + cellH * 0.25;
    ctx.fillStyle = `rgba(${led.color[0]},${led.color[1]},${led.color[2]},0.55)`;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  // --- Height map (source for normal map) ---
  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = TEX_SIZE;
  heightCanvas.height = TEX_SIZE;
  const hctx = heightCanvas.getContext('2d')!;
  hctx.fillStyle = '#ffffff';
  hctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  drawGrid(hctx, '#404040', '#1c1c1c');

  // Shallow dents from wear — reuse half the grime spots so dents correlate with grime.
  for (let i = 0; i < grimeSpots.length; i += 2) {
    const g = grimeSpots[i]!;
    const grad = hctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 0.6);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(g.x, g.y, g.r * 0.6, 0, Math.PI * 2);
    hctx.fill();
  }

  hctx.lineWidth = 1;
  for (const s of scratches) {
    const dx = Math.cos(s.ang) * s.len;
    const dy = Math.sin(s.ang) * s.len;
    hctx.strokeStyle = 'rgba(0,0,0,0.3)';
    hctx.beginPath();
    hctx.moveTo(s.x, s.y);
    hctx.lineTo(s.x + dx, s.y + dy);
    hctx.stroke();
  }

  if (opts.rivets) {
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        if (!rivetOn[r]![c]) {
          continue;
        }
        const x = c * cellW;
        const y = r * cellH;
        hctx.fillStyle = 'rgba(0,0,0,0.4)';
        hctx.beginPath();
        hctx.arc(x, y, 2.6, 0, Math.PI * 2);
        hctx.fill();
        hctx.fillStyle = 'rgba(255,255,255,0.9)';
        hctx.beginPath();
        hctx.arc(x - 0.5, y - 0.5, 1.3, 0, Math.PI * 2);
        hctx.fill();
      }
    }
  }

  const heightData = hctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
  const heightAt = (x: number, y: number) => {
    const xi = ((x % TEX_SIZE) + TEX_SIZE) % TEX_SIZE;
    const yi = ((y % TEX_SIZE) + TEX_SIZE) % TEX_SIZE;
    return heightData[(yi * TEX_SIZE + xi) * 4]! / 255;
  };

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = TEX_SIZE;
  normalCanvas.height = TEX_SIZE;
  const nctx = normalCanvas.getContext('2d')!;
  const normalImage = nctx.createImageData(TEX_SIZE, TEX_SIZE);
  const strength = 2.2;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const idx = (y * TEX_SIZE + x) * 4;
      normalImage.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      normalImage.data[idx + 3] = 255;
    }
  }
  nctx.putImageData(normalImage, 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  // --- Roughness map (three.js samples the green channel only) ---
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = TEX_SIZE;
  roughCanvas.height = TEX_SIZE;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = 'rgb(196,196,196)';
  rctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = wear[r]![c]!;
      if (w > 0.55) {
        rctx.fillStyle = `rgba(235,235,235,${((w - 0.55) * 0.5).toFixed(3)})`;
        rctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
      }
    }
  }
  drawGrid(rctx, 'rgba(235,235,235,0.5)', 'rgba(235,235,235,0.5)');

  for (const g of grimeSpots) {
    const grad = rctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    grad.addColorStop(0, 'rgba(230,225,210,0.28)');
    grad.addColorStop(1, 'rgba(230,225,210,0)');
    rctx.fillStyle = grad;
    rctx.beginPath();
    rctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    rctx.fill();
  }

  rctx.lineWidth = 1;
  for (const s of scratches) {
    // Scratches expose bare metal underneath — lower roughness (shinier), not higher.
    const dx = Math.cos(s.ang) * s.len;
    const dy = Math.sin(s.ang) * s.len;
    rctx.strokeStyle = 'rgba(55,55,60,0.26)';
    rctx.beginPath();
    rctx.moveTo(s.x, s.y);
    rctx.lineTo(s.x + dx, s.y + dy);
    rctx.stroke();
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  // --- Emissive map (only built when there's actually something to glow) ---
  let emissiveMap: THREE.CanvasTexture | undefined;
  if (opts.accentRowFrac !== undefined || leds.length > 0) {
    const emCanvas = document.createElement('canvas');
    emCanvas.width = TEX_SIZE;
    emCanvas.height = TEX_SIZE;
    const ectx = emCanvas.getContext('2d')!;
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    if (opts.accentRowFrac !== undefined && opts.accentColor) {
      const [ar, ag, ab] = opts.accentColor;
      ectx.fillStyle = `rgb(${ar},${ag},${ab})`;
      ectx.fillRect(0, accentY, TEX_SIZE, accentH);
    }
    for (const led of leds) {
      const x = led.col * cellW + cellW * 0.5;
      const y = led.row * cellH + cellH * 0.25;
      ectx.fillStyle = `rgb(${led.color[0]},${led.color[1]},${led.color[2]})`;
      ectx.fillRect(x - 2, y - 2, 4, 4);
    }

    emissiveMap = new THREE.CanvasTexture(emCanvas);
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }

  return { map, normalMap, roughnessMap, emissiveMap };
}

function setRepeat(tex: SurfaceTextureSet, x: number, y: number) {
  tex.map.repeat.set(x, y);
  tex.normalMap.repeat.set(x, y);
  tex.roughnessMap.repeat.set(x, y);
  tex.emissiveMap?.repeat.set(x, y);
}

/** Builds an enclosed box room with panel-varied materials and a key/fill/rim lighting rig. */
export function buildRoom(): THREE.Group {
  const group = new THREE.Group();
  const size = ROOM_HALF * 2;

  // Wall: steel-blue panels, warm amber conduit band + sparse status LEDs (painted +
  // emissive so it reads as a lit power/data run threaded along the upper wall).
  const wallTex = createSurfaceTextureSet({
    seed: 1,
    cols: 8,
    rows: 8,
    baseColor: [78, 91, 105],
    jitter: 0.22,
    grimeCount: 9,
    scratchCount: 12,
    rivets: true,
    accentRowFrac: 0.8,
    accentColor: [232, 168, 96],
    ledCount: 5,
  });
  setRepeat(wallTex, size / 2, ROOM_HEIGHT / 2);

  // Floor: darker, denser plating with heavier grime/scratch wear (foot traffic) and no
  // painted accent — a tiling stripe would read as a repeating artifact on a walkable
  // plane, so floor accent color instead comes from the baseboard trim strip below.
  const floorTex = createSurfaceTextureSet({
    seed: 2,
    cols: 10,
    rows: 10,
    baseColor: [36, 44, 54],
    jitter: 0.26,
    grimeCount: 24,
    scratchCount: 30,
    rivets: true,
  });
  setRepeat(floorTex, size / 2, size / 2);

  // Ceiling: same family, darker and cleaner (less foot traffic wear reaches up here).
  const ceilingTex = createSurfaceTextureSet({
    seed: 3,
    cols: 6,
    rows: 6,
    baseColor: [26, 33, 42],
    jitter: 0.1,
    grimeCount: 4,
    scratchCount: 5,
    rivets: true,
  });
  setRepeat(ceilingTex, size / 3, size / 3);

  // Bumped from 0.55 — round-1 renders read as flat grey with no visible surface relief;
  // stronger relief gives the key light's rake something to catch specular/shadow on.
  const normalScale = new THREE.Vector2(0.75, 0.75);

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.map,
    normalMap: wallTex.normalMap,
    normalScale,
    roughnessMap: wallTex.roughnessMap,
    side: THREE.BackSide,
    roughness: 0.9,
    metalness: 0.06,
    emissive: 0xffffff,
    emissiveMap: wallTex.emissiveMap,
    // Round-1 was 1.3 — with the conduit band running the whole wall width that was
    // bright enough to bloom the entire upper wall into haze. Dropped well below 1.0 so
    // it reads as a lit (not overdriven) painted stripe; bloom pass now only catches the
    // sparse LED dots layered on top, which is the intended "small contained highlight".
    emissiveIntensity: 0.55,
  });
  // -Z face is cut open for the viewscreen; frame segments rebuild the wall around the hole.
  const wallMatOpen = new THREE.MeshStandardMaterial({ visible: false });
  const ceilingMat = new THREE.MeshStandardMaterial({
    map: ceilingTex.map,
    normalMap: ceilingTex.normalMap,
    normalScale,
    roughnessMap: ceilingTex.roughnessMap,
    side: THREE.BackSide,
    roughness: 0.92,
    metalness: 0.05,
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
  // Same panel texture family as the walls, tinted darker/more metallic so the frame still
  // reads as a distinct structural trim rather than a repeat of the flat wall.
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x76828e,
    map: wallTex.map,
    normalMap: wallTex.normalMap,
    normalScale,
    roughnessMap: wallTex.roughnessMap,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0.18,
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
      map: floorTex.map,
      normalMap: floorTex.normalMap,
      normalScale,
      roughnessMap: floorTex.roughnessMap,
      roughness: 0.94,
      metalness: 0.03,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);

  // --- Lit trim: perimeter strips baked as emissive geometry rather than texture, so
  // they read as real practical fixtures (cyan pathway lighting at the floor line, warm
  // coving tying into the ceiling practicals) instead of a flat painted-on stripe. ---
  const addPerimeterStrip = (
    y: number,
    thickness: number,
    height: number,
    material: THREE.Material,
  ) => {
    const inset = ROOM_HALF - thickness / 2;
    const spanBox = () => new THREE.BoxGeometry(size, height, thickness);
    const crossBox = () => new THREE.BoxGeometry(thickness, height, size);
    const north = new THREE.Mesh(spanBox(), material);
    north.position.set(0, y, inset);
    const south = new THREE.Mesh(spanBox(), material);
    south.position.set(0, y, -inset);
    const east = new THREE.Mesh(crossBox(), material);
    east.position.set(inset, y, 0);
    const west = new THREE.Mesh(crossBox(), material);
    west.position.set(-inset, y, 0);
    group.add(north, south, east, west);
  };

  // Round-1 emissiveIntensity (2.2) ran the full room perimeter at a raw-HDR multiplier —
  // that's what produced the "floor dissolves into milky haze" verdict: a continuous
  // bright ring easily clears any reasonable bloom threshold. Dropped under 1.0 so it
  // reads as a lit strip, with bloom now only picking up a slight contained glow at its
  // edge rather than flooding the whole lower frame.
  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0x0a1214,
    emissive: 0x35d8e0,
    emissiveIntensity: 0.65,
    roughness: 0.65,
    metalness: 0.08,
  });
  addPerimeterStrip(0.09, 0.05, 0.06, baseboardMat);

  const covingMat = new THREE.MeshStandardMaterial({
    color: 0x140f0a,
    emissive: 0xffab5c,
    emissiveIntensity: 0.55,
    roughness: 0.65,
    metalness: 0.08,
  });
  addPerimeterStrip(ROOM_HEIGHT - 0.09, 0.05, 0.06, covingMat);

  // Dark gunmetal corner posts — cheap structural read, breaks up the box silhouette.
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x1c232b,
    roughness: 0.55,
    metalness: 0.45,
  });
  const postSize = 0.12;
  const postInset = ROOM_HALF - postSize / 2 - 0.01;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, ROOM_HEIGHT, postSize), postMat);
      post.position.set(sx * postInset, ROOM_HEIGHT / 2, sz * postInset);
      group.add(post);
    }
  }

  // Low-output bezel tracing the inner viewscreen edge. It frames the opening without
  // adding enough cool emission to fog the black-space view behind it.
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x060d14,
    emissive: 0x4f8fbb,
    emissiveIntensity: 0.35,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const bezelThickness = 0.06;
  const bezelDepth = 0.03;
  const bezelZ = -ROOM_HALF + bezelDepth / 2 + 0.01;

  const bezelTop = new THREE.Mesh(
    new THREE.BoxGeometry(WINDOW_WIDTH + bezelThickness, bezelThickness, bezelDepth),
    bezelMat,
  );
  bezelTop.position.set(0, WINDOW_CENTER_Y + WINDOW_HEIGHT / 2 - bezelThickness / 2, bezelZ);
  group.add(bezelTop);

  const bezelBottom = new THREE.Mesh(
    new THREE.BoxGeometry(WINDOW_WIDTH + bezelThickness, bezelThickness, bezelDepth),
    bezelMat,
  );
  bezelBottom.position.set(0, WINDOW_CENTER_Y - WINDOW_HEIGHT / 2 + bezelThickness / 2, bezelZ);
  group.add(bezelBottom);

  const bezelLeft = new THREE.Mesh(
    new THREE.BoxGeometry(bezelThickness, WINDOW_HEIGHT, bezelDepth),
    bezelMat,
  );
  bezelLeft.position.set(-WINDOW_WIDTH / 2 + bezelThickness / 2, WINDOW_CENTER_Y, bezelZ);
  group.add(bezelLeft);

  const bezelRight = new THREE.Mesh(
    new THREE.BoxGeometry(bezelThickness, WINDOW_HEIGHT, bezelDepth),
    bezelMat,
  );
  bezelRight.position.set(WINDOW_WIDTH / 2 - bezelThickness / 2, WINDOW_CENTER_Y, bezelZ);
  group.add(bezelRight);

  // --- Lighting: cool hemisphere fill + warm directional/practical key + cool rim. ---
  // Round 1 stacked hemisphere(0.55) + directional(0.8) + 2 practicals(0.6/0.45) + rim(0.3)
  // on top of each other, which pushed plain lit (non-emissive) wall/floor pixels above
  // the bloom threshold too — geometry itself was blooming, not just the trim. Round 2
  // pulled every level down; this pass tightens it further because the broad, always-on
  // fill and right-side practical were still flattening the room into a bright test cell.
  const fill = new THREE.HemisphereLight(0x6d849d, 0x17110d, 0.18);
  group.add(fill);

  // Warm directional key, lowered and angled for a grazing rake across the wall panels so
  // the normal-map relief actually catches light/shadow instead of being lit flat from
  // near-overhead (round-1 position (4,6,3) was too steep to show surface detail).
  const key = new THREE.DirectionalLight(0xffc48a, 0.5);
  key.position.set(6, 3.4, 4);
  group.add(key);

  // Two warm ceiling practicals — round-2 critique: these read as bare glowing spheres
  // with no housing, because the housing disc (0.42r, near-black, indistinguishable from
  // the dark ceiling) was smaller than its own bloom halo, AND the point light sat only
  // ~0.4 units below the ceiling, close enough to blow a hard specular hotspot straight
  // onto the ceiling surface next to it (a second, unintended "orb" with no geometry at
  // all). Fixed with a proper 3-layer recessed-fixture stack (bright metal bezel ring /
  // dark recessed well / small glowing lens, sized so the lens sits clearly inside the
  // bezel rather than being lost in blur) and by moving the light further from the
  // ceiling + lowering its intensity/radius so it stops over-driving the adjacent surface.
  const fixtures: Array<{ x: number; z: number; intensity: number; distance: number }> = [
    { x: 3.2, z: 2.4, intensity: 0.18, distance: 8 },
    { x: -3, z: -1.8, intensity: 0.16, distance: 7.5 },
  ];
  const fixtureBezelMat = new THREE.MeshStandardMaterial({
    color: 0x8a94a0,
    roughness: 0.55,
    metalness: 0.35,
  });
  const fixtureWellMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e11,
    roughness: 0.7,
    metalness: 0.1,
  });
  const fixtureGlowMat = new THREE.MeshStandardMaterial({
    color: 0x1a1410,
    emissive: 0xffcf9c,
    emissiveIntensity: 0.78,
    roughness: 0.5,
    metalness: 0.1,
  });
  for (const f of fixtures) {
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 24), fixtureBezelMat);
    bezel.position.set(f.x, ROOM_HEIGHT - 0.015, f.z);
    group.add(bezel);

    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.025, 24), fixtureWellMat);
    well.position.set(f.x, ROOM_HEIGHT - 0.035, f.z);
    group.add(well);

    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24), fixtureGlowMat);
    glow.position.set(f.x, ROOM_HEIGHT - 0.06, f.z);
    group.add(glow);

    // Kept below the ceiling with a short radius so the fixture creates a local pool
    // of light rather than broad room fill.
    const light = new THREE.PointLight(0xffbf82, f.intensity, f.distance, 2);
    light.position.set(f.x, ROOM_HEIGHT - 0.65, f.z);
    group.add(light);
  }

  // Cool rim/accent light, wall-mounted as a sconce — round-3 critique: this was a bare
  // PointLight floating 1.5 units out from the wall with zero geometry nearby, reading as
  // a detached glowing orb. Fixed the same way as the ceiling fixtures: a real housing
  // (dark metal box) + a small emissive lens flush against a solid wall, with the light
  // itself pulled just in front of the lens rather than hovering in open space. Uses the
  // -X wall (not the -Z window wall) since that X position falls inside the window
  // opening on -Z, which has no solid wall surface to mount against.
  const sconceY = ROOM_HEIGHT * 0.55;
  const sconceZ = -2.5;
  const sconceHousingDepth = 0.06;
  const sconceLensDepth = 0.02;
  const sconceMat = new THREE.MeshStandardMaterial({
    color: 0x2a323c,
    roughness: 0.58,
    metalness: 0.32,
  });
  const sconceLensMat = new THREE.MeshStandardMaterial({
    color: 0x0a1420,
    emissive: 0x6f9fd8,
    emissiveIntensity: 0.65,
    roughness: 0.55,
    metalness: 0.08,
  });
  const sconceHousing = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.4, sconceHousingDepth),
    sconceMat,
  );
  sconceHousing.position.set(-ROOM_HALF + sconceHousingDepth / 2, sconceY, sconceZ);
  group.add(sconceHousing);

  const sconceLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.26, sconceLensDepth),
    sconceLensMat,
  );
  sconceLens.position.set(-ROOM_HALF + sconceHousingDepth + sconceLensDepth / 2, sconceY, sconceZ);
  group.add(sconceLens);

  const rim = new THREE.PointLight(0x6f9fd8, 0.14, 10, 2);
  rim.position.set(-ROOM_HALF + 0.3, sconceY, sconceZ);
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
