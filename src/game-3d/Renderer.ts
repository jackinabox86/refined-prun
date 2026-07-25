import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export const OVERLAY_Z_INDEX = 2147483646;

/**
 * Stacks a WebGLRenderer and CSS3DRenderer in a fullscreen overlay, both driven
 * by the same PerspectiveCamera each frame.
 */
export class DualRenderer {
  readonly container: HTMLDivElement;
  readonly webgl: THREE.WebGLRenderer;
  readonly css3d: CSS3DRenderer;
  readonly canvas: HTMLCanvasElement;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(OVERLAY_Z_INDEX),
      overflow: 'hidden',
      background: '#111',
    });

    const webglLayer = document.createElement('div');
    Object.assign(webglLayer.style, {
      position: 'absolute',
      inset: '0',
    });

    // CSS3D sits on top; container ignores events so empty space reaches the canvas.
    const css3dLayer = document.createElement('div');
    Object.assign(css3dLayer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });

    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setClearColor(0x111111);
    this.canvas = this.webgl.domElement;
    Object.assign(this.canvas.style, {
      display: 'block',
      width: '100%',
      height: '100%',
    });
    webglLayer.append(this.canvas);

    this.css3d = new CSS3DRenderer();
    Object.assign(this.css3d.domElement.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    css3dLayer.append(this.css3d.domElement);

    this.container.append(webglLayer, css3dLayer);
  }

  setSize(width: number, height: number) {
    this.webgl.setSize(width, height, false);
    this.css3d.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    this.webgl.render(scene, camera);
    this.css3d.render(scene, camera);
  }

  dispose() {
    this.webgl.dispose();
    this.container.remove();
  }
}
