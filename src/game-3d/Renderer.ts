import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

export const OVERLAY_Z_INDEX = 2147483646;

/**
 * Full post-processing chain (bloom + filmic output + vignette) costs a real 2-4x
 * slowdown on this harness's software-rendered baseline (SwiftShader, no real GPU) —
 * not meaningful on real GPU hardware. Default is ON because real users get real
 * hardware and this is a genuine visual-quality lever (emissive trim/conduits and
 * practical lights are authored assuming bloom is present). Flip to false only for
 * fast local iteration in this dev harness; don't ship it off.
 */
const POSTFX_ENABLED = true;

/**
 * Stacks a WebGLRenderer and CSS3DRenderer in a fullscreen overlay, both driven
 * by the same PerspectiveCamera each frame.
 */
export class DualRenderer {
  readonly container: HTMLDivElement;
  readonly webgl: THREE.WebGLRenderer;
  readonly css3d: CSS3DRenderer;
  readonly canvas: HTMLCanvasElement;
  private composer?: EffectComposer;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(OVERLAY_Z_INDEX),
      overflow: 'hidden',
      background: '#05070a',
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
    this.webgl.setClearColor(0x05070a);
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    // Filmic tonemapping + sRGB output — applies to every render path (both the plain
    // renderer.render() fallback below and, via OutputPass, the composer chain), so
    // the room's material/light values read correctly regardless of POSTFX_ENABLED.
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.0;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
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
    this.composer?.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!POSTFX_ENABLED) {
      this.webgl.render(scene, camera);
      this.css3d.render(scene, camera);
      return;
    }
    if (this.composer === undefined) {
      this.composer = new EffectComposer(this.webgl);
      this.composer.addPass(new RenderPass(scene, camera));
      // Strength/radius/threshold tuned tight so only genuinely bright emissive
      // sources (conduit trim, fixture discs, console/hologram glow) bloom, and do so
      // as a small contained highlight rather than a wide soft wash. A high threshold
      // matters more than it looks here: with several stacked room lights, ordinary lit
      // (non-emissive) wall/floor pixels can otherwise cross a low threshold too and
      // bloom the whole room into haze — round-1 regression, fixed by pushing threshold
      // well above typical lit-surface luminance and keeping radius small (contained
      // glow, not a blob with no discernible edge).
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.18,
        0.13,
        1.02,
      );
      this.composer.addPass(bloomPass);
      // Converts the composer's linear working-space buffer to the renderer's
      // configured tone mapping + sRGB output — required because intermediate
      // composer passes (like bloom) operate before that conversion happens.
      this.composer.addPass(new OutputPass());
      // Subtle framing vignette, applied last so it darkens the final display image.
      const vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms.offset.value = 0.92;
      vignettePass.uniforms.darkness.value = 0.68;
      this.composer.addPass(vignettePass);
    }
    this.composer.render();
    this.css3d.render(scene, camera);
  }

  dispose() {
    this.webgl.dispose();
    this.container.remove();
  }
}
