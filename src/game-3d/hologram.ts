import * as THREE from 'three';
import { starsStore } from '@src/infrastructure/prun-api/data/stars';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { ROOM_HALF } from '@src/game-3d/room';

/** World-unit span of the star-map display footprint, sized to read from across the 16×16 room. */
const HOLOGRAM_SPAN = 5.2;

/**
 * Room corner diagonally opposite the -Z viewscreen wall, clear of both the flt (+X wall)
 * and companyops (+Z wall) consoles. 2026-07-26 playtest feedback: the hologram previously
 * sat at room center and read as "in the middle of everything."
 */
export const HOLOGRAM_POSITION = new THREE.Vector3(ROOM_HALF - 2.4, 1.4, ROOM_HALF - 2.4);

const STAR_COLORS: Record<PrunApi.StarType, number> = {
  O: 0x9bb0ff,
  B: 0xaabfff,
  A: 0xf8f7ff,
  F: 0xfff4ea,
  G: 0xfff2a1,
  K: 0xffd2a1,
  M: 0xffb56c,
};

const DEFAULT_STAR_COLOR = 0xcccccc;

/** Cyan "projector chrome" tint shared by lines/base/motes/sweep — distinct from real star colors. */
const HOLO_ACCENT = new THREE.Color(0x6fe0ff);
const CORE_COLOR = new THREE.Color(0xa8f4ff);

const RING_SPECS = [
  { radius: 0.86, y: 0.04, tiltX: 0.18, tiltZ: -0.1 },
  { radius: 1.46, y: 0.62, tiltX: -0.28, tiltZ: 0.16 },
  { radius: 2.12, y: 1.26, tiltX: 0.34, tiltZ: 0.24 },
];

const BASE_Y = -0.78;
const CORE_Y = 0.68;
const MAJOR_NODE_COUNT = 5;

/** Idle spin of the whole star map, radians/second. Slow enough to read as ambient, not spinning. */
const ROTATION_SPEED = 0.12;

/** Handle returned by {@link buildHologram}: the renderable group plus its per-frame animator. */
export interface Hologram {
  readonly group: THREE.Group;
  /** Advances shader time uniforms, idle rotation, and the scan sweep. No-op when built empty. */
  update(elapsedSeconds: number): void;
}

const NOOP_UPDATE = () => {};

function emptyHologram(group: THREE.Group): Hologram {
  return { group, update: NOOP_UPDATE };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnit(value: string): number {
  return stableHash(value) / 0xffffffff;
}

function rotateIntoRingPlane(position: THREE.Vector3, tiltX: number, tiltZ: number): THREE.Vector3 {
  return position.clone().applyEuler(new THREE.Euler(tiltX, 0, tiltZ));
}

function createArcGeometry(
  radius: number,
  startAngle: number,
  endAngle: number,
  tiltX: number,
  tiltZ: number,
): THREE.BufferGeometry {
  const segmentCount = 80;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const point = rotateIntoRingPlane(
      new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
      tiltX,
      tiltZ,
    );
    points.push(point);
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

/** Rim-lit "energy shell" fresnel material used for the glowing halo around each star node. */
function createNodeGlowMaterial(color: THREE.Color, phase: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
      uPhase: { value: phase },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uPhase;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 2.4);
        float flicker = 0.72 + 0.28 * sin(uTime * 2.1 + uPhase);
        float intensity = fresnel * flicker;
        gl_FragColor = vec4(uColor * (0.5 + intensity), clamp(intensity, 0.0, 1.0));
      }
    `,
  });
}

/** Energized connection line: dim baseline glow plus a traveling light pulse per segment. */
function createLineMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aT;
      attribute float aSeed;
      varying float vT;
      varying float vSeed;
      void main() {
        vT = aT;
        vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying float vT;
      varying float vSeed;
      void main() {
        float travel = fract(uTime * 0.4 + vSeed);
        float pulse = smoothstep(0.16, 0.0, abs(vT - travel));
        float base = 0.16 + 0.05 * sin(uTime * 1.7 + vSeed * 6.28318);
        float intensity = base + pulse * 1.1;
        gl_FragColor = vec4(uColor * intensity, clamp(intensity, 0.0, 1.0));
      }
    `,
  });
}

/** Flat radial-gradient glow disc standing in for the hologram's projector base. */
function createBaseMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float dist = distance(vUv, vec2(0.5));
        float glow = smoothstep(0.5, 0.0, dist);
        float ring = smoothstep(0.05, 0.0, abs(dist - 0.42));
        float flicker = 0.85 + 0.15 * sin(uTime * 1.6);
        float intensity = (glow * 0.55 + ring * 1.3) * flicker;
        gl_FragColor = vec4(uColor * intensity, clamp(intensity, 0.0, 1.0));
      }
    `,
  });
}

/** Wide additive column that gives the hologram a readable vertical body from room distance. */
function createBeamMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPosition;
      void main() {
        vUv = uv;
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vLocalPosition;
      void main() {
        float edge = 0.72 + 0.28 * pow(abs(vLocalPosition.y), 0.6);
        float vertical = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.76, vUv.y);
        float scan = 0.78 + 0.22 * sin(vUv.y * 34.0 - uTime * 2.6);
        float intensity = edge * vertical * scan;
        gl_FragColor = vec4(uColor * (0.9 + intensity), clamp(intensity * 0.46, 0.0, 0.7));
      }
    `,
  });
}

/** Rising light-motes drifting up out of the projector base, looping. */
function createMoteMaterial(
  color: THREE.Color,
  baseY: number,
  cycleHeight: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: color },
      uTime: { value: 0 },
      uBaseY: { value: baseY },
      uCycle: { value: cycleHeight },
    },
    vertexShader: `
      attribute float aSeed;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uBaseY;
      uniform float uCycle;
      varying float vAlpha;
      void main() {
        float rise = mod(aSeed * uCycle + uTime * aSpeed, uCycle);
        vec3 pos = position;
        pos.y = uBaseY + rise;
        float t = rise / uCycle;
        vAlpha = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.65, t);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = 130.0 / max(0.6, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) {
          discard;
        }
        float edge = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor, edge * vAlpha * 0.9);
      }
    `,
  });
}

function createTubeBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.LineCurve3(from, to), 1, radius, 8);
}

/**
 * One-shot snapshot of the player's sector as a floating holographic star map.
 * Not reactive — star topology does not change mid-session.
 */
export function buildHologram(): Hologram {
  const group = new THREE.Group();

  const sites = sitesStore.all.value;
  if (sites === undefined || sites.length === 0) {
    return emptyHologram(group);
  }

  const planetNaturalId = getEntityNaturalIdFromAddress(sites[0].address);
  if (planetNaturalId === undefined) {
    return emptyHologram(group);
  }

  const reference = starsStore.getByPlanetNaturalId(planetNaturalId);
  if (reference === undefined) {
    return emptyHologram(group);
  }

  const allStars = starsStore.all.value;
  if (allStars === undefined) {
    return emptyHologram(group);
  }

  const region = allStars.filter(x => x.sectorId === reference.sectorId);
  if (region.length === 0) {
    return emptyHologram(group);
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const star of region) {
    const { x, y, z } = star.position;
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (z < minZ) {
      minZ = z;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
    if (z > maxZ) {
      maxZ = z;
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const timeUniformMaterials: THREE.ShaderMaterial[] = [];

  const sortedByImportance = [...region].sort((a, b) => {
    const degreeDiff = b.connections.length - a.connections.length;
    if (degreeDiff !== 0) {
      return degreeDiff;
    }
    return a.systemId.localeCompare(b.systemId);
  });
  const majorIds = new Set<string>([reference.systemId]);
  for (const star of sortedByImportance) {
    if (majorIds.size >= Math.min(MAJOR_NODE_COUNT, region.length)) {
      break;
    }
    majorIds.add(star.systemId);
  }

  const ringCounts = new Array<number>(RING_SPECS.length).fill(0);
  const ringSlots = new Map<string, number>();
  const ringStars = new Map<string, number>();
  const sortedRegion = [...region].sort((a, b) => {
    const aAngle = Math.atan2(a.position.z - centerZ, a.position.x - centerX);
    const bAngle = Math.atan2(b.position.z - centerZ, b.position.x - centerX);
    if (aAngle !== bAngle) {
      return aAngle - bAngle;
    }
    return a.systemId.localeCompare(b.systemId);
  });
  for (const star of sortedRegion) {
    const normalizedY =
      maxY === minY ? hashUnit(star.systemId) : (star.position.y - minY) / (maxY - minY);
    const sourceRing = Math.min(RING_SPECS.length - 1, Math.floor(normalizedY * RING_SPECS.length));
    const ringIndex = majorIds.has(star.systemId) ? Math.max(1, sourceRing) : sourceRing;
    ringSlots.set(star.systemId, ringCounts[ringIndex]);
    ringStars.set(star.systemId, ringIndex);
    ringCounts[ringIndex]++;
  }

  const positions = new Map<string, THREE.Vector3>();
  const coreGeometry = new THREE.SphereGeometry(0.058, 12, 12);
  const majorCoreGeometry = new THREE.SphereGeometry(0.12, 16, 16);
  const glowGeometry = new THREE.SphereGeometry(0.18, 16, 16);
  const majorGlowGeometry = new THREE.SphereGeometry(0.36, 24, 24);
  const majorGlyphGeometry = new THREE.TorusGeometry(0.25, 0.018, 10, 56);

  let minNormY = Infinity;
  let maxNormY = -Infinity;
  let maxRadiusXZ = 0;

  for (const star of sortedRegion) {
    const ringIndex = ringStars.get(star.systemId)!;
    const slot = ringSlots.get(star.systemId)!;
    const ring = RING_SPECS[ringIndex];
    const slotCount = ringCounts[ringIndex];
    const sourceAngle = Math.atan2(star.position.z - centerZ, star.position.x - centerX);
    const fallbackAngle = (slot / Math.max(1, slotCount)) * Math.PI * 2;
    const angle = (sourceAngle === 0 ? fallbackAngle : sourceAngle) + ringIndex * 0.42;
    const radiusJitter = (hashUnit(`${star.systemId}:radius`) - 0.5) * 0.18;
    const majorLift = majorIds.has(star.systemId) ? 0.14 : 0;
    const pos = rotateIntoRingPlane(
      new THREE.Vector3(
        Math.cos(angle) * (ring.radius + radiusJitter),
        0,
        Math.sin(angle) * (ring.radius + radiusJitter),
      ),
      ring.tiltX,
      ring.tiltZ,
    );
    pos.y += ring.y + majorLift;
    positions.set(star.systemId, pos);
    if (pos.y < minNormY) {
      minNormY = pos.y;
    }
    if (pos.y > maxNormY) {
      maxNormY = pos.y;
    }
    const radiusXZ = Math.hypot(pos.x, pos.z);
    if (radiusXZ > maxRadiusXZ) {
      maxRadiusXZ = radiusXZ;
    }

    const color = new THREE.Color(STAR_COLORS[star.type] ?? DEFAULT_STAR_COLOR);
    const isMajor = majorIds.has(star.systemId);

    const core = new THREE.Mesh(
      isMajor ? majorCoreGeometry : coreGeometry,
      new THREE.MeshBasicMaterial({ color }),
    );
    core.position.copy(pos);
    group.add(core);

    const glowMaterial = createNodeGlowMaterial(
      color,
      hashUnit(`${star.systemId}:phase`) * Math.PI * 2,
    );
    timeUniformMaterials.push(glowMaterial);
    const glow = new THREE.Mesh(isMajor ? majorGlowGeometry : glowGeometry, glowMaterial);
    glow.position.copy(pos);
    group.add(glow);

    if (isMajor) {
      const glyph = new THREE.Mesh(
        majorGlyphGeometry,
        new THREE.MeshBasicMaterial({
          color: HOLO_ACCENT,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glyph.position.copy(pos);
      glyph.rotation.set(Math.PI / 2 + ring.tiltX, 0, ring.tiltZ + angle * 0.2);
      group.add(glyph);
    }
  }

  const mapCorePosition = new THREE.Vector3(0, CORE_Y, 0);
  const mapCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 32, 32),
    new THREE.MeshBasicMaterial({ color: CORE_COLOR }),
  );
  mapCore.position.copy(mapCorePosition);
  group.add(mapCore);

  const coreGlowMaterial = createNodeGlowMaterial(CORE_COLOR, 0.33);
  timeUniformMaterials.push(coreGlowMaterial);
  const mapCoreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.82, 40, 40), coreGlowMaterial);
  mapCoreGlow.position.copy(mapCorePosition);
  group.add(mapCoreGlow);

  const coreShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 32, 24),
    new THREE.MeshBasicMaterial({
      color: CORE_COLOR,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreShell.position.copy(mapCorePosition);
  group.add(coreShell);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: HOLO_ACCENT,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const arcMaterial = new THREE.LineBasicMaterial({
    color: HOLO_ACCENT,
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const [index, ring] of RING_SPECS.entries()) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(ring.radius, 0.026 + index * 0.012, 12, 112),
      ringMaterial,
    );
    orbit.position.y = ring.y;
    orbit.rotation.set(Math.PI / 2 + ring.tiltX, 0, ring.tiltZ);
    group.add(orbit);

    const arc = new THREE.Line(
      createArcGeometry(
        ring.radius + 0.09,
        index * 0.72,
        index * 0.72 + Math.PI * 1.32,
        ring.tiltX,
        ring.tiltZ,
      ),
      arcMaterial,
    );
    arc.position.y = ring.y;
    group.add(arc);
  }

  const cageGeometry = new THREE.TorusGeometry(RING_SPECS[2].radius * 0.9, 0.026, 10, 112);
  for (const rotationY of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
    const cage = new THREE.Mesh(cageGeometry, ringMaterial);
    cage.position.y = CORE_Y;
    cage.rotation.y = rotationY;
    cage.scale.y = 0.72;
    group.add(cage);
  }

  // Connections are listed on both ends; only draw each unordered pair once.
  // Skip targets outside the filtered sector — their positions are not in this hologram.
  const seen = new Set<string>();
  const linePositions: number[] = [];
  const lineProgress: number[] = [];
  const lineSeeds: number[] = [];
  for (const star of region) {
    const from = positions.get(star.systemId)!;
    for (const targetId of star.connections) {
      const to = positions.get(targetId);
      if (to === undefined) {
        continue;
      }
      const a = star.systemId < targetId ? star.systemId : targetId;
      const b = star.systemId < targetId ? targetId : star.systemId;
      const key = `${a}|${b}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      linePositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
      const seed = hashUnit(key);
      lineProgress.push(0, 1);
      lineSeeds.push(seed, seed);
    }
  }
  for (const starId of majorIds) {
    const to = positions.get(starId);
    if (to === undefined) {
      continue;
    }
    linePositions.push(mapCorePosition.x, mapCorePosition.y, mapCorePosition.z, to.x, to.y, to.z);
    const seed = hashUnit(`${starId}:core-line`);
    lineProgress.push(0, 1);
    lineSeeds.push(seed, seed);
  }

  const majorSpokeMaterial = new THREE.MeshBasicMaterial({
    color: HOLO_ACCENT,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const starId of majorIds) {
    const to = positions.get(starId);
    if (to === undefined) {
      continue;
    }
    group.add(new THREE.Mesh(createTubeBetween(mapCorePosition, to, 0.026), majorSpokeMaterial));
  }

  if (linePositions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    geometry.setAttribute('aT', new THREE.Float32BufferAttribute(lineProgress, 1));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(lineSeeds, 1));
    const lineMaterial = createLineMaterial(HOLO_ACCENT);
    timeUniformMaterials.push(lineMaterial);
    group.add(new THREE.LineSegments(geometry, lineMaterial));
  }

  // Projector base: a glowing disc under the star field, plus motes drifting up out of it —
  // reads as "the map is being projected from below" rather than floating dots in a vacuum.
  const baseY = Math.min(BASE_Y, minNormY - 0.18);
  const topY = maxNormY + 0.36;
  const discRadius = Math.max(1.65, maxRadiusXZ * 1.42);

  const pedestalMaterial = new THREE.MeshStandardMaterial({
    color: 0x12242a,
    emissive: 0x0d6f86,
    emissiveIntensity: 0.55,
    roughness: 0.38,
    metalness: 0.72,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(discRadius * 0.42, discRadius * 0.55, 0.26, 64),
    pedestalMaterial,
  );
  pedestal.position.y = baseY - 0.18;
  group.add(pedestal);

  const projectorRingMaterial = new THREE.MeshBasicMaterial({
    color: HOLO_ACCENT,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lowerProjectorRing = new THREE.Mesh(
    new THREE.TorusGeometry(discRadius * 0.62, 0.04, 12, 96),
    projectorRingMaterial,
  );
  lowerProjectorRing.rotation.x = Math.PI / 2;
  lowerProjectorRing.position.y = baseY - 0.04;
  group.add(lowerProjectorRing);

  const upperProjectorRing = new THREE.Mesh(
    new THREE.TorusGeometry(discRadius * 0.38, 0.032, 10, 80),
    projectorRingMaterial,
  );
  upperProjectorRing.rotation.x = Math.PI / 2;
  upperProjectorRing.position.y = baseY + 0.05;
  group.add(upperProjectorRing);

  const baseMaterial = createBaseMaterial(HOLO_ACCENT);
  timeUniformMaterials.push(baseMaterial);
  const base = new THREE.Mesh(new THREE.CircleGeometry(discRadius, 48), baseMaterial);
  base.rotation.x = -Math.PI / 2;
  base.position.y = baseY;
  group.add(base);

  const beamHeight = Math.max(2.7, topY - baseY + 0.5);
  const beamMaterial = createBeamMaterial(HOLO_ACCENT);
  timeUniformMaterials.push(beamMaterial);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(discRadius * 0.24, discRadius * 0.34, beamHeight, 48, 1, true),
    beamMaterial,
  );
  beam.position.y = baseY + beamHeight / 2;
  group.add(beam);

  const moteCount = 52;
  const motePositions: number[] = [];
  const moteSeeds: number[] = [];
  const moteSpeeds: number[] = [];
  for (let i = 0; i < moteCount; i++) {
    const seed = hashUnit(`mote:${i}`);
    const radiusSeed = hashUnit(`mote:${i}:radius`);
    const speedSeed = hashUnit(`mote:${i}:speed`);
    const angle = seed * Math.PI * 2;
    const radius = discRadius * 0.85 * Math.sqrt(radiusSeed);
    motePositions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    moteSeeds.push(seed);
    moteSpeeds.push(0.12 + speedSeed * 0.1);
  }
  const moteCycle = Math.max(0.4, topY - baseY) + 0.3;
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(moteSeeds, 1));
  moteGeometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(moteSpeeds, 1));
  const moteMaterial = createMoteMaterial(HOLO_ACCENT, baseY, moteCycle);
  timeUniformMaterials.push(moteMaterial);
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.frustumCulled = false;
  group.add(motes);

  // Scan sweep: a faint horizontal plane repeatedly rising through the star field, evoking a
  // holographic scanner pass rather than a static display.
  const sweepSize = Math.max(HOLOGRAM_SPAN, discRadius * 2) * 1.15;
  const sweepMaterial = new THREE.MeshBasicMaterial({
    color: HOLO_ACCENT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(sweepSize, sweepSize), sweepMaterial);
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.y = baseY;
  group.add(sweep);

  const sweepSpan = Math.max(0.05, topY - baseY);
  const sweepPeriod = 4.5;

  function update(elapsedSeconds: number) {
    group.rotation.y = elapsedSeconds * ROTATION_SPEED;
    for (const material of timeUniformMaterials) {
      material.uniforms.uTime.value = elapsedSeconds;
    }
    const t = (elapsedSeconds % sweepPeriod) / sweepPeriod;
    sweep.position.y = baseY + t * sweepSpan;
    const edgeFade = Math.min(t, 1 - t);
    sweepMaterial.opacity = 0.16 * Math.min(1, edgeFade * 6);
  }

  return { group, update };
}
