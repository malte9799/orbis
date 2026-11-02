import * as THREE from 'three';
import type { CustomLayerInterface, CustomRenderMethodInput, MapMouseEvent, Map as MlMap } from 'maplibre-gl';
import { GeoFrame, type Vec3 } from './frame';

// One custom layer and one three.js renderer for everything 3D on a map.
//
// On the flat map the scene is drawn straight into the map, so terrain hides what is behind it. On
// the globe that does not work: MapLibre's depth buffer holds the distance to the horizon plane there
// instead of a real depth (globeComputeClippingZ), and labels drawn later still read it. So the scene
// gets a framebuffer with a depth buffer of its own and is laid over the map afterwards; the globe
// itself hides things by a ray test (GeoFrame.occluded, the fragment shader of GeoLine).

/** Something the camera can be focused on. */
export interface GeoTarget {
  /** the source it comes from and its name there: the address of the view is source/slug */
  readonly source: string;
  readonly slug: string;
  readonly label: string;
  /** [lon, lat, altitude m] at this time; null: it is gone */
  position(now: number): Vec3 | null;
  /** further values of the source for the address (follow.<name>), e.g. a point in time */
  params?(): Record<string, string>;
  /** the camera starts / stops following it */
  entered?(): void;
  released?(): void;
}

/** Something on the stage that is not followed but opens the usual click handling of a layer. */
export interface GeoFeature {
  layerId: string;
  properties: Record<string, unknown>;
}

/** how close to a target (CSS px) a click still hits it */
const PICK_PX = 24;
/** how often the cursor looks for a target below it (ms): when the mouse moves, and when only the objects do */
const HOVER_MOVE_MS = 40;
const HOVER_FRAME_MS = 100;
/** terrain is drawn anew in every frame: while only the objects move, this is enough for them (ms) */
const TERRAIN_FRAME_MS = 66;

export interface GeoPart {
  readonly object: THREE.Object3D;
  /** the name of this source in the address */
  readonly source?: string;
  /** what can be clicked in this part */
  targets?(): GeoTarget[];
  /** The feature at a screen point, for parts whose objects can only be clicked. */
  featureAt?(frame: GeoFrame, x: number, y: number): GeoFeature | null;
  /** The target an address names; by default found by its slug among the targets. */
  resolve?(slug: string, params: Record<string, string>): GeoTarget | null | Promise<GeoTarget | null>;
  /** Called every frame before drawing; true: keeps the map repainting (something moves). */
  update(frame: GeoFrame, now: number): boolean | void;
  dispose?(): void;
}

const COMPOSITE_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;
// the framebuffer is linear and premultiplied, the map's canvas sRGB and premultiplied
const COMPOSITE_FRAGMENT = `
uniform sampler2D uTex;
varying vec2 vUv;
vec3 encode(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec4 c = texture2D(uTex, vUv);
  if (c.a <= 0.0) discard;
  gl_FragColor = vec4(encode(c.rgb / c.a) * c.a, c.a);
}`;

export class GeoStage implements CustomLayerInterface {
  readonly id = 'geo3d-stage';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  /** the frame drawn last, for labels and picking between two frames */
  frame: GeoFrame | null = null;
  /** set: the time parts are drawn at, so that a moving focus and the camera following it agree exactly */
  clock: number | null = null;
  /** set: names are given by the distance to this object, not to the camera */
  nearPoint: Vec3 | null = null;
  private renderer?: THREE.WebGLRenderer;
  private target?: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private overlay = new THREE.Scene();
  private overlayMat = new THREE.ShaderMaterial({
    vertexShader: COMPOSITE_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    uniforms: { uTex: { value: null } },
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private parts: GeoPart[] = [];
  /** the mouse over the map (CSS px); null: elsewhere or pressed */
  private mouse: { x: number; y: number } | null = null;
  private hovering = false;
  private lastHover = 0;
  private repaintTimer = 0;

  /** a source was added: the address may be waiting for it */
  onSource: (() => void) | null = null;

  constructor(private map: MlMap) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5), this.sun);
    const triangle = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const cover = new THREE.Mesh(triangle, this.overlayMat);
    cover.frustumCulled = false;
    this.overlay.add(cover);
  }

  /** The layer only joins the map with its first part: until then the map draws as if the stage did not exist. */
  add(part: GeoPart) {
    this.parts.push(part);
    this.scene.add(part.object);
    if (!this.map.getLayer(this.id)) this.map.addLayer(this);
    this.map.triggerRepaint();
    if (part.source) this.onSource?.();
  }

  remove(part: GeoPart) {
    this.parts = this.parts.filter((p) => p !== part);
    this.scene.remove(part.object);
    part.dispose?.();
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    map.on('mousemove', this.onMouseMove);
    map.on('mouseout', this.onMouseOut);
  }

  onRemove() {
    clearTimeout(this.repaintTimer);
    this.repaintTimer = 0;
    this.map.off('mousemove', this.onMouseMove);
    this.map.off('mouseout', this.onMouseOut);
    this.onMouseOut();
    this.target?.dispose();
    this.target = undefined;
    this.renderer?.dispose();
    this.renderer = undefined;
  }

  render(_gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const renderer = this.renderer;
    if (!renderer) return;
    const canvas = this.map.getCanvas();
    const pd = args.defaultProjectionData;
    const frame = new GeoFrame({
      mainMatrix: pd.mainMatrix as ArrayLike<number>,
      fallbackMatrix: pd.fallbackMatrix as ArrayLike<number>,
      transition: pd.projectionTransition,
      center: this.map.getCenter(),
      fov: args.fov,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      ratio: canvas.width / canvas.clientWidth,
    });
    frame.nearPoint = this.nearPoint;
    this.frame = frame;
    const now = this.clock ?? performance.now();
    let moving = false;
    for (const p of this.parts) if (p.update(frame, now)) moving = true;
    // nothing to draw: no framebuffer and no pass over the whole screen
    if (this.parts.some((p) => p.object.visible)) this.draw(renderer, frame, canvas);
    if (this.mouse && performance.now() - this.lastHover > HOVER_FRAME_MS) this.updateHover();
    if (moving && !document.hidden) this.repaint();
  }

  private draw(renderer: THREE.WebGLRenderer, frame: GeoFrame, canvas: HTMLCanvasElement) {
    this.camera.projectionMatrix.copy(frame.proj);
    // the light comes from the camera's side: on a sphere no fixed direction lights all models
    if (frame.globe) this.sun.position.set(frame.camera[0] - frame.origin[0], frame.camera[1] - frame.origin[1], frame.camera[2] - frame.origin[2]);
    else this.sun.position.set(0.4, -0.6, 1);

    renderer.resetState();
    renderer.setViewport(0, 0, canvas.width, canvas.height);
    if (frame.globe) {
      const target = this.renderTarget(canvas.width, canvas.height);
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(null);
      this.overlayMat.uniforms.uTex.value = target.texture;
      renderer.render(this.overlay, this.camera);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(this.scene, this.camera);
    }
  }

  /** The next frame for moving objects; the map draws at full rate anyway while the camera moves. */
  private repaint() {
    if (!this.map.getTerrain() || this.map.isMoving()) {
      this.map.triggerRepaint();
    } else if (!this.repaintTimer) {
      this.repaintTimer = window.setTimeout(() => {
        this.repaintTimer = 0;
        this.map.triggerRepaint();
      }, TERRAIN_FRAME_MS);
    }
  }

  private onMouseMove = (e: MapMouseEvent) => {
    this.mouse = e.originalEvent.buttons ? null : { x: e.point.x, y: e.point.y };
    if (!this.mouse) this.setHover(false);
    else if (performance.now() - this.lastHover > HOVER_MOVE_MS) this.updateHover();
  };

  private onMouseOut = () => {
    this.mouse = null;
    this.setHover(false);
  };

  private updateHover() {
    this.lastHover = performance.now();
    this.setHover(!!this.mouse && (!!this.pick(this.mouse.x, this.mouse.y) || !!this.pickFeature(this.mouse.x, this.mouse.y)));
  }

  /** On the container, not the canvas: the app sets and clears the canvas' cursor for its own layers. */
  private setHover(over: boolean) {
    if (over === this.hovering) return;
    this.hovering = over;
    this.map.getCanvasContainer().style.cursor = over ? 'pointer' : '';
  }

  hasSource(source: string) {
    return this.parts.some((p) => p.source === source);
  }

  /** The target an address names; null: no such source or object. */
  resolve(source: string, slug: string, params: Record<string, string>): GeoTarget | null | Promise<GeoTarget | null> {
    const part = this.parts.find((p) => p.source === source);
    if (!part) return null;
    if (part.resolve) return part.resolve(slug, params);
    return part.targets?.().find((t) => t.slug === slug) ?? null;
  }

  /** Is this target at a screen point (CSS px)? */
  hits(target: GeoTarget, x: number, y: number): boolean {
    const p = target.position(this.clock ?? performance.now());
    const s = p && this.frame?.toScreen(p[0], p[1], p[2]);
    return !!s && Math.hypot(s[0] - x, s[1] - y) < PICK_PX;
  }

  /** The target at a screen point (CSS px), hidden ones excluded. */
  pick(x: number, y: number): GeoTarget | null {
    const frame = this.frame;
    if (!frame) return null;
    const now = this.clock ?? performance.now();
    let best: GeoTarget | null = null;
    let bestD = PICK_PX;
    for (const part of this.parts) {
      for (const target of part.targets?.() ?? []) {
        const p = target.position(now);
        const s = p && part.object.visible ? frame.toScreen(p[0], p[1], p[2]) : null;
        if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < bestD) {
          bestD = d;
          best = target;
        }
      }
    }
    return best;
  }

  /** The feature at a screen point (CSS px). */
  pickFeature(x: number, y: number): GeoFeature | null {
    const frame = this.frame;
    if (!frame) return null;
    for (const part of this.parts) {
      const f = part.object.visible ? part.featureAt?.(frame, x, y) : null;
      if (f) return f;
    }
    return null;
  }

  private renderTarget(w: number, h: number) {
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples: 4,
        depthBuffer: true,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
      });
    } else if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
    }
    return this.target;
  }
}
