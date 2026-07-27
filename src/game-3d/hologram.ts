import * as THREE from 'three';
import { starsStore } from '@src/infrastructure/prun-api/data/stars';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { ROOM_HALF } from '@src/game-3d/room';

/** World-unit span of the hologram's longest axis (fits comfortably in the 16×16×3.5 room). */
const HOLOGRAM_SPAN = 2.4;

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

/**
 * One-shot snapshot of the player's sector as a floating star map.
 * Not reactive — star topology does not change mid-session.
 */
export function buildHologram(): THREE.Group {
  const group = new THREE.Group();

  const sites = sitesStore.all.value;
  if (sites === undefined || sites.length === 0) {
    return group;
  }

  const planetNaturalId = getEntityNaturalIdFromAddress(sites[0].address);
  if (planetNaturalId === undefined) {
    return group;
  }

  const reference = starsStore.getByPlanetNaturalId(planetNaturalId);
  if (reference === undefined) {
    return group;
  }

  const allStars = starsStore.all.value;
  if (allStars === undefined) {
    return group;
  }

  const region = allStars.filter(x => x.sectorId === reference.sectorId);
  if (region.length === 0) {
    return group;
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

  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  // Single-star (or coincident) regions have zero extent; avoid divide-by-zero.
  const scale = extent === 0 ? 1 : HOLOGRAM_SPAN / extent;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const positions = new Map<string, THREE.Vector3>();
  const sphereGeometry = new THREE.SphereGeometry(0.04, 12, 12);

  for (const star of region) {
    const pos = new THREE.Vector3(
      (star.position.x - centerX) * scale,
      (star.position.y - centerY) * scale,
      (star.position.z - centerZ) * scale,
    );
    positions.set(star.systemId, pos);

    const color = STAR_COLORS[star.type] ?? DEFAULT_STAR_COLOR;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.position.copy(pos);
    group.add(mesh);
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
    const material = new THREE.LineBasicMaterial({ color: 0x4a6a8a });
    group.add(new THREE.LineSegments(geometry, material));
  }

  return group;
}
