import * as THREE from 'three';
import { starsStore } from '@src/infrastructure/prun-api/data/stars';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { ROOM_HALF } from '@src/game-3d/room';

/**
 * World-unit span of the star-map display footprint. The corner mount only has 2.4 units
 * of wall clearance on +X/+Z, so 3.6 keeps the fixed half-extent at 1.8 and leaves a
 * 0.6-unit margin. This bounds, but does not guarantee, future datasets with extreme
 * aspect ratios cannot push an outlier close to the margin again.
 */
const HOLOGRAM_SPAN = 3.6;

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

/** Pale route-line tint, kept distinct from the room's saturated cyan trim. */
const HOLO_ACCENT = new THREE.Color(0xd8f5ff);
const MAJOR_NODE_COUNT = 5;
const MAJOR_DOT_RADIUS = 0.12;
const MINOR_DOT_RADIUS = 0.07;

/** Handle returned by {@link buildHologram}: the renderable group plus its per-frame hook. */
export interface Hologram {
  readonly group: THREE.Group;
  /** Advances the hologram when needed. Static maps use a no-op. */
  update(elapsedSeconds: number): void;
}

const NOOP_UPDATE = () => {};

function emptyHologram(group: THREE.Group): Hologram {
  return { group, update: NOOP_UPDATE };
}

/**
 * One-shot snapshot of the player's sector as a flat route map.
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
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const star of region) {
    const { x, z } = star.position;
    if (x < minX) {
      minX = x;
    }
    if (z < minZ) {
      minZ = z;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (z > maxZ) {
      maxZ = z;
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const layoutScale = HOLOGRAM_SPAN / Math.max(spanX, spanZ, 0.001);

  const TANK_RADIUS = HOLOGRAM_SPAN / 2 + 0.25;
  const TANK_HEIGHT = 0.55;

  const tankGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbfe8ff,
    transparent: true,
    transmission: 0.9,
    roughness: 0.08,
    thickness: 0.05,
    ior: 1.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const tankGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(TANK_RADIUS, TANK_RADIUS, TANK_HEIGHT, 64, 1, true),
    tankGlassMaterial,
  );
  tankGlass.position.y = TANK_HEIGHT / 2 - 0.08;
  group.add(tankGlass);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a96a3,
    metalness: 0.8,
    roughness: 0.22,
  });
  for (const y of [
    tankGlass.position.y - TANK_HEIGHT / 2,
    tankGlass.position.y + TANK_HEIGHT / 2,
  ]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TANK_RADIUS, 0.025, 16, 96), rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    group.add(rim);
  }

  const plinthMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a323c,
    metalness: 0.7,
    roughness: 0.3,
  });
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(TANK_RADIUS + 0.1, TANK_RADIUS + 0.14, 0.08, 64),
    plinthMaterial,
  );
  plinth.position.y = tankGlass.position.y - TANK_HEIGHT / 2 - 0.04;
  group.add(plinth);

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

  const positions = new Map<string, THREE.Vector3>();
  for (const star of region) {
    const pos = new THREE.Vector3(
      (star.position.x - centerX) * layoutScale,
      0,
      (star.position.z - centerZ) * layoutScale,
    );
    positions.set(star.systemId, pos);

    const isMajor = majorIds.has(star.systemId);
    const color = new THREE.Color(STAR_COLORS[star.type] ?? DEFAULT_STAR_COLOR);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(isMajor ? MAJOR_DOT_RADIUS : MINOR_DOT_RADIUS, 16, 16),
      new THREE.MeshBasicMaterial({ color }),
    );
    dot.position.copy(pos);
    group.add(dot);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry((isMajor ? MAJOR_DOT_RADIUS : MINOR_DOT_RADIUS) * 2.2, 14, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.copy(pos);
    group.add(glow);
  }

  // Connections are listed on both ends; only draw each unordered pair once.
  // Skip targets outside the filtered sector — their positions are not in this hologram.
  const seen = new Set<string>();
  const linePositions: number[] = [];
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
    }
  }

  if (linePositions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: HOLO_ACCENT,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    group.add(new THREE.LineSegments(geometry, lineMaterial));
  }

  return { group, update: NOOP_UPDATE };
}
