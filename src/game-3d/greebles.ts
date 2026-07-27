import * as THREE from 'three';
import { ROOM_HALF } from '@src/game-3d/room';

const RIVET_COUNT = 24;
const VENT_COUNT = 16;
const PIPE_COUNT = 20;

interface WallPoint {
  position: THREE.Vector3;
  facingAngle: number;
}

/** Uniformly samples a point along one of the 4 room wall bases, with the wall's outward-facing angle. */
function sampleWallBase(): WallPoint {
  const wallIndex = Math.floor(Math.random() * 4);
  const t = Math.random() * 2 - 1;
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
    case 2:
      return {
        position: new THREE.Vector3(t * ROOM_HALF, 0, ROOM_HALF - inset),
        facingAngle: Math.PI,
      };
    default:
      return { position: new THREE.Vector3(t * ROOM_HALF, 0, -ROOM_HALF + inset), facingAngle: 0 };
  }
}

function buildInstancedScatter(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  heightRange: [number, number],
  rotationOffset = 0,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const point = sampleWallBase();
    const y = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
    euler.set(0, point.facingAngle + rotationOffset + (Math.random() - 0.5) * 0.2, 0);
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

/** One-shot, non-reactive wall-base clutter — purely cosmetic, not part of console hit-testing. */
export function buildGreebles(): THREE.Group {
  const group = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x9aa5b0,
    roughness: 0.4,
    metalness: 0.8,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    roughness: 0.6,
    metalness: 0.4,
  });

  group.add(
    buildInstancedScatter(
      new THREE.BoxGeometry(0.06, 0.06, 0.03),
      metalMat,
      RIVET_COUNT,
      [0.1, 1.2],
    ),
  );
  group.add(
    buildInstancedScatter(new THREE.BoxGeometry(0.3, 0.15, 0.04), darkMat, VENT_COUNT, [0.3, 0.9]),
  );

  const pipeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
  pipeGeometry.rotateZ(Math.PI / 2);
  group.add(buildInstancedScatter(pipeGeometry, metalMat, PIPE_COUNT, [0.15, 0.15], Math.PI / 2));

  return group;
}
