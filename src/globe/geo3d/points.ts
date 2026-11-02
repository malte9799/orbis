import * as THREE from 'three';
import type { GeoFrame } from './frame';
import { BEHIND_GLOBE_GLSL } from './line';

// Many dots of a fixed pixel size at a real height, only on the globe. Each dot has two positions
// on the unit sphere's scale, a little time apart: the GPU moves it between them, so thousands of
// satellites move smoothly with one new set of positions every few seconds.

const VERTEX = `
attribute vec3 aNext;
attribute vec3 aColor;
attribute float aSize;
uniform mat4 uGlobe;
uniform float uMix;
uniform float uRatio;
varying vec3 vColor;
${BEHIND_GLOBE_GLSL}
void main() {
  vec3 p = mix(position, aNext, uMix);
  vColor = aColor;
  if (behindGlobe(p)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  gl_Position = uGlobe * vec4(p, 1.0);
  gl_PointSize = aSize * uRatio;
}`;
const FRAGMENT = `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, uOpacity * smoothstep(1.0, 0.7, d));
  #include <colorspace_fragment>
}`;

export class GeoPoints {
  readonly object: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uGlobe: { value: new THREE.Matrix4() },
        uMix: { value: 0 },
        uRatio: { value: 1 },
        uOpacity: { value: 1 },
        uHide: { value: 1 },
        uCam: { value: new THREE.Vector3() },
        uCentre: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,
    });
    this.object = new THREE.Points(new THREE.BufferGeometry(), this.mat);
    this.object.matrixAutoUpdate = false;
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  /** New dots: `colors` as rgb per dot (0..1, linear), `sizes` as diameters in CSS pixels. */
  setDots(colors: Float32Array, sizes: Float32Array) {
    const n = sizes.length;
    this.object.geometry.dispose();
    this.object.geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aNext', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
      .setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  }

  /** The two sets of positions the dots move between. */
  setPositions(from: Float32Array, to: Float32Array) {
    const g = this.object.geometry;
    for (const [name, values] of [['position', from], ['aNext', to]] as const) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      (a.array as Float32Array).set(values);
      a.needsUpdate = true;
    }
  }

  /** `mix`: how far along between the two sets of positions (0..1). */
  update(frame: GeoFrame, mix: number) {
    const u = this.mat.uniforms;
    this.object.visible = frame.globe;
    if (!frame.globe) return;
    u.uGlobe.value.copy(frame.globeMatrix);
    u.uMix.value = mix;
    u.uRatio.value = frame.pixels[0] / frame.width;
    u.uOpacity.value = frame.t;
    u.uCam.value.set(frame.camera[0], frame.camera[1], frame.camera[2]);
  }

  dispose() {
    this.object.geometry.dispose();
    this.mat.dispose();
  }
}
