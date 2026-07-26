import * as THREE from 'three';

export interface PanelHitTarget {
  mesh: THREE.Mesh;
  root: HTMLElement;
  widthPx: number;
  heightPx: number;
}

export function createPanelHitPlane(
  root: HTMLElement,
  widthPx: number,
  heightPx: number,
  widthWorld: number,
  heightWorld: number,
): PanelHitTarget {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthWorld, heightWorld));
  mesh.visible = false;
  return { mesh, root, widthPx, heightPx };
}

export function createPanelRaycaster(camera: THREE.Camera, targets: PanelHitTarget[]) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const meshes = targets.map(t => t.mesh);
  const targetByMesh = new Map(targets.map(t => [t.mesh, t] as const));

  const findClickTarget = (clientX: number, clientY: number): Element | undefined => {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit === undefined || hit.uv === undefined) {
      return undefined;
    }
    const target = targetByMesh.get(hit.object as THREE.Mesh);
    if (target === undefined) {
      return undefined;
    }
    const localX = hit.uv.x * target.widthPx;
    const localY = (1 - hit.uv.y) * target.heightPx;
    return elementFromLocalPoint(target.root, localX, localY) ?? target.root;
  };

  return { findClickTarget };
}

function elementFromLocalPoint(
  root: HTMLElement,
  localX: number,
  localY: number,
): Element | undefined {
  const parent = root.parentNode;
  const nextSibling = root.nextSibling;
  const prevPosition = root.style.position;
  const prevTransform = root.style.transform;
  const prevLeft = root.style.left;
  const prevTop = root.style.top;
  const prevZIndex = root.style.zIndex;

  document.body.append(root);
  root.style.position = 'fixed';
  root.style.transform = 'none';
  root.style.left = `${-localX}px`;
  root.style.top = `${-localY}px`;
  root.style.zIndex = '2147483647';

  const el = document.elementFromPoint(0, 0);

  root.style.position = prevPosition;
  root.style.transform = prevTransform;
  root.style.left = prevLeft;
  root.style.top = prevTop;
  root.style.zIndex = prevZIndex;
  if (nextSibling !== null) {
    parent?.insertBefore(root, nextSibling);
  } else {
    parent?.appendChild(root);
  }

  return el ?? undefined;
}
