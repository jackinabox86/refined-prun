import * as THREE from 'three';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { buildShipMesh } from '@src/game-3d/hangar';

const ARM_COUNT = 6;
const ARM_LENGTH = 24;
const ARM_THICKNESS = 0.56;
const HUB_RADIUS = 3.1;
const HUB_HEIGHT = 5.2;
const GANTRY_RADIUS = 8.6;
const GANTRY_TUBE = 0.34;
const SHIP_LENGTH_MIN = 6;
const SHIP_LENGTH_MAX = 11;
const FAINT_STAR_COUNT = 90;
const SOFT_STAR_COUNT = 36;
const HERO_STAR_COUNT = 18;
const SUN_DISTANCE = 185;
const STATION_ROTATION_Y = THREE.MathUtils.degToRad(8);

const ARM_STRIPE_COLOR = 0x56d7ff;

function spaceMaterial<T extends THREE.Material>(material: T): T {
  (material as T & { fog: boolean }).fog = false;
  return material;
}

/** Soft radial glow for the distant sun sprite. */
function createSunTexture(): THREE.CanvasTexture {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 250, 230, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 230, 160, 0.95)');
  gradient.addColorStop(0.4, 'rgba(255, 180, 60, 0.45)');
  gradient.addColorStop(0.7, 'rgba(255, 120, 20, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft circular mask for WebGL point sprites; avoids default square point quads. */
function createStarTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.48, 'rgba(255, 255, 255, 0.34)');
  gradient.addColorStop(0.78, 'rgba(255, 255, 255, 0.06)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildPlanet(): THREE.Sprite {
  const material = spaceMaterial(
    new THREE.SpriteMaterial({
      map: createSunTexture(),
      color: 0xffc878,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sprite = new THREE.Sprite(material);
  sprite.position.set(-18, 4.5, -155);
  sprite.scale.set(16, 16, 1);
  return sprite;
}

function createStarPositions(count: number, clustered: boolean): Float32Array {
  const positions = new Float32Array(count * 3);
  const clusters = [
    new THREE.Vector3(-50, 14, -82),
    new THREE.Vector3(30, -7, -104),
    new THREE.Vector3(58, 16, -142),
  ];
  for (let i = 0; i < count; i++) {
    if (clustered) {
      const cluster = clusters[Math.floor(Math.random() * clusters.length)];
      positions[i * 3] = cluster.x + (Math.random() - 0.5) * 24;
      positions[i * 3 + 1] = cluster.y + (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = cluster.z + (Math.random() - 0.5) * 18;
      continue;
    }

    const centerBias = Math.pow(Math.random(), 1.5);
    positions[i * 3] = (Math.random() - 0.5) * (200 + centerBias * 180);
    positions[i * 3 + 1] = (Math.random() - 0.5) * (110 + centerBias * 100);
    positions[i * 3 + 2] = -(28 + Math.random() * 138);
  }
  return positions;
}

function createStarColors(count: number, opacityFloor: number): Float32Array {
  const palette = [0xfff4dc, 0xd8ecff, 0xc3d7ff, 0xffdf9e].map(x => new THREE.Color(x));
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)].clone();
    color.multiplyScalar(opacityFloor + Math.random() * (1 - opacityFloor));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  return colors;
}

function buildStarLayer(
  count: number,
  size: number,
  opacity: number,
  texture: THREE.Texture,
  opacityFloor: number,
  clustered = false,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(createStarPositions(count, clustered), 3),
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(createStarColors(count, opacityFloor), 3),
  );
  return new THREE.Points(
    geometry,
    spaceMaterial(
      new THREE.PointsMaterial({
        map: texture,
        size,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity,
        alphaTest: 0.02,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
}

function buildStarfield(): THREE.Group {
  const group = new THREE.Group();
  const texture = createStarTexture();
  group.add(buildStarLayer(FAINT_STAR_COUNT, 2.2, 0.5, texture, 0.06));
  group.add(buildStarLayer(SOFT_STAR_COUNT, 3.5, 0.65, texture, 0.16));
  group.add(buildStarLayer(HERO_STAR_COUNT, 6, 1.0, texture, 0.7, true));
  return group;
}

function buildSun(): THREE.Sprite {
  const material = spaceMaterial(
    new THREE.SpriteMaterial({
      map: createSunTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sprite = new THREE.Sprite(material);
  sprite.position.set(60, 22, -SUN_DISTANCE);
  sprite.scale.set(21, 21, 1);
  return sprite;
}

function buildSunBleed(): THREE.Group {
  const group = new THREE.Group();
  const material = spaceMaterial(
    new THREE.SpriteMaterial({
      map: createSunTexture(),
      color: 0xffb05a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const glow = new THREE.Sprite(material);
  glow.position.set(30, 4, -112);
  glow.scale.set(36, 15, 1);
  group.add(glow);

  const streakMat = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xff9d48,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(58, 1.15), streakMat);
  streak.position.set(20, 4.6, -78);
  streak.rotation.z = THREE.MathUtils.degToRad(-3);
  group.add(streak);

  return group;
}

function buildStructureBloomGlows(): THREE.Group {
  const group = new THREE.Group();
  const texture = createSunTexture();
  const glows = [
    {
      color: 0x6beaff,
      opacity: 0.12,
      position: [-16, 5.5, -46] as const,
      scale: [42, 20] as const,
    },
    {
      color: 0xffb05a,
      opacity: 0.1,
      position: [34, 7.5, -150] as const,
      scale: [54, 26] as const,
    },
  ];

  for (const glow of glows) {
    const material = spaceMaterial(
      new THREE.SpriteMaterial({
        map: texture,
        color: glow.color,
        transparent: true,
        opacity: glow.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.position.set(glow.position[0], glow.position[1], glow.position[2]);
    sprite.scale.set(glow.scale[0], glow.scale[1], 1);
    group.add(sprite);
  }

  return group;
}

function buildFarStructures(): THREE.Group {
  const group = new THREE.Group();
  const material = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x202a34,
      roughness: 0.58,
      metalness: 0.58,
      emissive: 0x071c26,
      emissiveIntensity: 0.34,
      transparent: true,
      opacity: 0.26,
    }),
  );
  const lightMat = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffc25a,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  for (const spec of [{ x: 31, y: -2.6, z: -138, scale: 1.35, rotation: 17 }]) {
    const structure = new THREE.Group();
    structure.position.set(spec.x, spec.y, spec.z);
    structure.rotation.y = THREE.MathUtils.degToRad(spec.rotation);
    structure.scale.setScalar(spec.scale);

    const truss = new THREE.Mesh(new THREE.BoxGeometry(28, 0.52, 0.72), material);
    structure.add(truss);

    for (const x of [-12, -6, 0, 6, 12]) {
      const module = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.8, 1.4), material);
      module.position.set(x, 0.05, 0);
      structure.add(module);

      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.2), lightMat);
      marker.position.set(x, 1.62, 0.82);
      structure.add(marker);
    }

    group.add(structure);
  }

  return group;
}

function buildStation(): THREE.Group {
  const station = new THREE.Group();
  station.position.set(4, 1.6, 0);
  station.rotation.y = STATION_ROTATION_Y;

  const hubMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x2b3540,
      roughness: 0.45,
      metalness: 0.72,
      emissive: 0x081b23,
      emissiveIntensity: 0.58,
    }),
  );
  const armMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x303944,
      roughness: 0.5,
      metalness: 0.64,
      emissive: 0x071924,
      emissiveIntensity: 0.42,
    }),
  );
  const greebleMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x29333f,
      roughness: 0.5,
      metalness: 0.54,
      emissive: 0x0a2a36,
      emissiveIntensity: 0.86,
    }),
  );
  const stripeMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: ARM_STRIPE_COLOR,
      roughness: 0.35,
      metalness: 0.2,
      emissive: ARM_STRIPE_COLOR,
      emissiveIntensity: 4.2,
    }),
  );
  const beaconMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xbdf4ff,
      roughness: 0.25,
      metalness: 0,
      emissive: 0x56d7ff,
      emissiveIntensity: 7.2,
    }),
  );
  const warmBeaconMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xffc08a,
      roughness: 0.25,
      metalness: 0,
      emissive: 0xff8c35,
      emissiveIntensity: 5.8,
    }),
  );
  const hullMaterial = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x38434f,
      roughness: 0.75,
      metalness: 0.28,
      emissive: 0x091d26,
      emissiveIntensity: 0.52,
    }),
  );
  const bridgeMaterial = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x27333f,
      roughness: 0.8,
      metalness: 0.22,
      emissive: 0x0a2029,
      emissiveIntensity: 0.56,
    }),
  );
  const gantryMat = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x333d49,
      roughness: 0.42,
      metalness: 0.7,
      emissive: 0x0a2430,
      emissiveIntensity: 0.76,
    }),
  );
  const magentaStripMat = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xff4ed8,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const amberStripMat = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffb24b,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const orbitalGantry = new THREE.Group();
  orbitalGantry.position.z = 18;
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(GANTRY_RADIUS, GANTRY_TUBE, 12, 128),
    gantryMat,
  );
  orbitalGantry.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(GANTRY_RADIUS * 0.68, GANTRY_TUBE * 0.45, 8, 96),
    gantryMat,
  );
  orbitalGantry.add(innerRing);

  const tealArc = new THREE.Mesh(
    new THREE.TorusGeometry(GANTRY_RADIUS * 1.03, GANTRY_TUBE * 0.36, 8, 48, Math.PI * 0.72),
    spaceMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x53f4ff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  tealArc.rotation.z = THREE.MathUtils.degToRad(196);
  orbitalGantry.add(tealArc);

  const magentaArc = new THREE.Mesh(
    new THREE.TorusGeometry(GANTRY_RADIUS * 0.8, GANTRY_TUBE * 0.32, 8, 40, Math.PI * 0.48),
    magentaStripMat,
  );
  magentaArc.rotation.z = THREE.MathUtils.degToRad(18);
  orbitalGantry.add(magentaArc);

  const amberArc = new THREE.Mesh(
    new THREE.TorusGeometry(GANTRY_RADIUS * 0.92, GANTRY_TUBE * 0.3, 8, 40, Math.PI * 0.38),
    amberStripMat,
  );
  amberArc.rotation.z = THREE.MathUtils.degToRad(106);
  orbitalGantry.add(amberArc);

  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18;
    const segment = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.36, 0.5), gantryMat);
    segment.position.set(Math.cos(angle) * GANTRY_RADIUS, Math.sin(angle) * GANTRY_RADIUS, 0);
    segment.rotation.z = angle;
    orbitalGantry.add(segment);
  }

  for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(GANTRY_RADIUS * 1.35, 0.24, 0.38), armMat);
    spoke.rotation.z = angle;
    orbitalGantry.add(spoke);
  }

  const dockLightGeometry = new THREE.SphereGeometry(0.18, 12, 8);
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    const material = i % 3 === 0 ? warmBeaconMat : beaconMat;
    const light = new THREE.Mesh(dockLightGeometry, material);
    light.position.set(
      Math.cos(angle) * GANTRY_RADIUS * 0.83,
      Math.sin(angle) * GANTRY_RADIUS * 0.83,
      0.22,
    );
    orbitalGantry.add(light);
  }

  const dockedShip = buildShipMesh(12.5, hullMaterial, bridgeMaterial);
  dockedShip.position.set(3.8, -2.9, 0.75);
  dockedShip.rotation.set(THREE.MathUtils.degToRad(-8), Math.PI / 2, THREE.MathUtils.degToRad(5));
  orbitalGantry.add(dockedShip);

  station.add(orbitalGantry);

  // Stacked industrial hub.
  const hubCore = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 1.15, HUB_HEIGHT, 18),
    hubMat,
  );
  station.add(hubCore);

  const hubRing = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_RADIUS * 1.4, HUB_RADIUS * 1.4, HUB_HEIGHT * 0.25, 24),
    hubMat,
  );
  hubRing.position.y = 0;
  station.add(hubRing);

  const greeblePlacements = [
    { angle: 0.35, y: 1.2, size: [0.34, 0.2, 0.22] as const },
    { angle: 1.85, y: 0.35, size: [0.18, 0.38, 0.2] as const },
    { angle: 3.15, y: -0.65, size: [0.4, 0.18, 0.28] as const },
    { angle: 4.55, y: 0.95, size: [0.24, 0.28, 0.18] as const },
  ];
  for (const placement of greeblePlacements) {
    const greeble = new THREE.Mesh(new THREE.BoxGeometry(...placement.size), greebleMat);
    const radius = HUB_RADIUS * 1.18;
    greeble.position.set(
      Math.sin(placement.angle) * radius,
      placement.y,
      Math.cos(placement.angle) * radius,
    );
    greeble.rotation.y = placement.angle;
    station.add(greeble);
  }

  const ships = shipsStore.all.value;
  const shipCount =
    ships === undefined || ships.length === 0 ? 0 : Math.min(ships.length, ARM_COUNT);

  for (let i = 0; i < ARM_COUNT; i++) {
    const angle = THREE.MathUtils.degToRad((360 / ARM_COUNT) * i);
    const armGroup = new THREE.Group();
    armGroup.rotation.y = angle;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS, ARM_THICKNESS * 0.7, ARM_LENGTH),
      armMat,
    );
    // Arm extends outward along local +Z from the hub rim.
    arm.position.z = HUB_RADIUS + ARM_LENGTH / 2;
    armGroup.add(arm);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS * 0.34, ARM_THICKNESS * 0.1, ARM_LENGTH * 0.9),
      stripeMat,
    );
    stripe.position.set(0, ARM_THICKNESS * 0.38, HUB_RADIUS + ARM_LENGTH / 2);
    armGroup.add(stripe);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), beaconMat);
    beacon.scale.setScalar(1.7);
    beacon.position.set(0, ARM_THICKNESS * 0.24, HUB_RADIUS + ARM_LENGTH);
    armGroup.add(beacon);

    const undersideBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), warmBeaconMat);
    undersideBeacon.scale.setScalar(1.8);
    undersideBeacon.position.set(0, -ARM_THICKNESS * 0.38, HUB_RADIUS + ARM_LENGTH * 0.72);
    armGroup.add(undersideBeacon);

    if (i < shipCount) {
      // Vary length across arms so the fleet doesn't look cloned.
      const t = i / (ARM_COUNT - 1);
      const length = SHIP_LENGTH_MIN + t * (SHIP_LENGTH_MAX - SHIP_LENGTH_MIN);
      const ship = buildShipMesh(length, hullMaterial, bridgeMaterial);
      // Point hull roughly along the arm (length axis is local Z of the ship mesh).
      ship.position.set(i % 2 === 0 ? 0.7 : -0.7, 0, HUB_RADIUS + ARM_LENGTH + length * 0.35);
      ship.rotation.y = THREE.MathUtils.degToRad(i % 2 === 0 ? -8 : 8);
      armGroup.add(ship);
    }

    station.add(armGroup);
  }

  return station;
}

function buildExteriorLights(): THREE.Group {
  const lights = new THREE.Group();

  const cyanRim = new THREE.PointLight(0x65e8ff, 0.94, 82, 1.15);
  cyanRim.position.set(-13, 8, 18);
  lights.add(cyanRim);

  const amberRim = new THREE.PointLight(0xffad55, 0.68, 66, 1.2);
  amberRim.position.set(14, -4, 14);
  lights.add(amberRim);

  const magentaFill = new THREE.PointLight(0xff55cf, 0.18, 48, 1.6);
  magentaFill.position.set(3, 5, 2);
  lights.add(magentaFill);

  const edgeWash = new THREE.DirectionalLight(0xa7f6ff, 0.19);
  edgeWash.position.set(-0.8, 0.45, 1);
  lights.add(edgeWash);

  return lights;
}

/**
 * Distant docking-arm diorama seen through the room's -Z wall opening.
 * Station sits at local origin; caller positions the whole group outside the room.
 */
export function buildViewscreen(): THREE.Group {
  const group = new THREE.Group();
  group.add(buildStarfield());
  group.add(buildPlanet());
  group.add(buildSun());
  group.add(buildSunBleed());
  group.add(buildStructureBloomGlows());
  group.add(buildExteriorLights());
  group.add(buildFarStructures());
  group.add(buildStation());
  return group;
}
