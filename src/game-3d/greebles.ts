import * as THREE from 'three';
import { ROOM_HALF } from '@src/game-3d/room';

const RIVET_COUNT = 42;
const VENT_COUNT = 26;
const PIPE_COUNT = 28;
const CEILING_GRILLE_COUNT = 18;

interface WallPoint {
  position: THREE.Vector3;
  facingAngle: number;
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

/** Uniformly samples a point along one of the solid room wall bases, with the wall's outward-facing angle. */
function sampleWallBase(rng: () => number): WallPoint {
  const wallIndex = Math.floor(rng() * 3);
  const t = rng() * 2 - 1;
  const inset = 0.06;
  switch (wallIndex) {
    case 0:
      return {
        position: new THREE.Vector3(ROOM_HALF - inset, 0, t * ROOM_HALF),
        facingAngle: Math.PI / 2,
      };
    case 1:
      return {
        position: new THREE.Vector3(-ROOM_HALF + inset, 0, t * ROOM_HALF),
        facingAngle: -Math.PI / 2,
      };
    default:
      return {
        position: new THREE.Vector3(t * ROOM_HALF, 0, ROOM_HALF - inset),
        facingAngle: Math.PI,
      };
  }
}

function buildInstancedScatter(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  heightRange: [number, number],
  rng: () => number,
  rotationOffset = 0,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const point = sampleWallBase(rng);
    const y = heightRange[0] + rng() * (heightRange[1] - heightRange[0]);
    euler.set(0, point.facingAngle + rotationOffset + (rng() - 0.5) * 0.2, 0);
    quaternion.setFromEuler(euler);
    matrix.compose(
      new THREE.Vector3(point.position.x, y, point.position.z),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function addCeilingGrilles(group: THREE.Group, material: THREE.Material, rng: () => number) {
  const geometry = new THREE.BoxGeometry(0.55, 0.035, 0.08);
  for (let i = 0; i < CEILING_GRILLE_COUNT; i++) {
    const x = (rng() * 2 - 1) * (ROOM_HALF - 1.6);
    const z = (rng() * 2 - 1) * (ROOM_HALF - 1.6);
    if (Math.abs(x) < 3.8 && Math.abs(z) < 3.8) {
      continue;
    }
    const grille = new THREE.Group();
    const slatCount = 4;
    for (let s = 0; s < slatCount; s++) {
      const slat = new THREE.Mesh(geometry, material);
      slat.position.z = (s - (slatCount - 1) / 2) * 0.12;
      grille.add(slat);
    }
    grille.position.set(x, 3.38, z);
    grille.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    group.add(grille);
  }
}

/** One-shot, non-reactive wall-base clutter — purely cosmetic, not part of console hit-testing. */
export function buildGreebles(): THREE.Group {
  const group = new THREE.Group();
  const rng = mulberry32(73);

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x7f8b95,
    roughness: 0.34,
    metalness: 0.86,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x151a20,
    roughness: 0.52,
    metalness: 0.58,
  });

  group.add(
    buildInstancedScatter(
      new THREE.BoxGeometry(0.06, 0.06, 0.03),
      metalMat,
      RIVET_COUNT,
      [0.1, 1.2],
      rng,
    ),
  );
  group.add(
    buildInstancedScatter(
      new THREE.BoxGeometry(0.42, 0.12, 0.05),
      darkMat,
      VENT_COUNT,
      [0.35, 1.55],
      rng,
    ),
  );

  const pipeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
  pipeGeometry.rotateZ(Math.PI / 2);
  group.add(
    buildInstancedScatter(pipeGeometry, metalMat, PIPE_COUNT, [0.15, 0.22], rng, Math.PI / 2),
  );
  addCeilingGrilles(group, darkMat, rng);

  return group;
}
