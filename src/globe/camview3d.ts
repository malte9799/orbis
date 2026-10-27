import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';
import { textureSafe } from './hls';
import { rayPoint } from './layers/shared/camfit';
import type { CamPose } from '../api/camdircloud';

// 3D view of the selected road camera (like God's Eye View): a view pyramid from the camera up to an
// upright picture board that shows the live video (or the still image) in the camera's viewing
// direction. Mount height and view angle are typical values, the direction mostly the road's
// direction of travel – the board shows roughly where the camera looks, it is not calibrated.
// With a known pose of the camera (tilt, height, roll, field of view – worked out in the direction editor) the
// picture is laid onto the ground exactly where the camera sees it: a floor with a wall behind it, built from the
// rays of the picture, so the road in the picture lies on the road of the map.
// Built lazily on the first selection; gone again once the popup that opened it is closed.

const MOUNT_M = 10;
const FOV_DEG = 56;
/** distance of the board from the camera in metres: fixed size on the map, it shrinks when zooming out like the map itself */
const DIST_M = 120;
const COLOR = 0x7cfc9a;
/** with a known pose: how far the floor reaches before the picture continues upright as a wall (metres) */
const WALL_M = 90;

export interface CamView {
  lon: number;
  lat: number;
  /** viewing direction, degrees clockwise from north */
  dir: number;
  /** the playing video of the popup (live stream), shared so the stream loads only once */
  video?: HTMLVideoElement;
  /** still image (needs CORS to be usable as a texture) */
  image?: string;
  /** pose of the camera: the picture is then projected onto the ground (otherwise it stands upright as a typical-values board) */
  pose?: CamPose;
  /** the panel element: when it leaves the page or is hidden, the view is removed */
  anchor: HTMLElement;
}

export class CamViewLayer implements CustomLayerInterface {
  readonly id = 'cam-view-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map!: MlMap;
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private group = new THREE.Group();
  private board: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private frame: THREE.LineSegments;
  private view: CamView | null = null;
  private texture: THREE.Texture | null = null;
  private aspect = 16 / 9;
  private watch = 0;
  private proj = new THREE.Matrix4();

  constructor() {
    // built for distance 1 in front of the camera (+y), scaled per frame; a unit plane in x/z facing
    // the camera, sized in layout()
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(Math.PI / 2);
    this.board = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0b1a1a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    this.frame = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.9 }));
    this.group.add(this.board, this.frame);
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    this.scene.add(this.group);
    this.layout();
  }

  /** board height follows the picture's aspect ratio; the pyramid runs from the camera to its corners */
  private layout() {
    if (this.view?.pose) return this.layoutPose(this.view.pose);
    if (!(this.board.geometry instanceof THREE.PlaneGeometry)) {
      this.board.geometry.dispose();
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.rotateX(Math.PI / 2);
      this.board.geometry = geo;
    }
    const w = 2 * Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
    const h = w / this.aspect;
    // the board stands a little above the camera's line of sight, so it does not sink into the ground
    const zc = h / 2 + 0.12;
    this.board.position.set(0, 1, zc);
    this.board.scale.set(w, 1, h);
    const c = [
      [-w / 2, 1, zc - h / 2],
      [w / 2, 1, zc - h / 2],
      [w / 2, 1, zc + h / 2],
      [-w / 2, 1, zc + h / 2],
    ];
    const pts: number[] = [];
    for (let i = 0; i < 4; i++) pts.push(0, 0, 0, ...c[i], ...c[i], ...c[(i + 1) % 4]);
    this.frame.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.frame.geometry.computeBoundingSphere();
  }

  /** the picture as floor + wall: every grid point sits on its own ray, at the ground or at the maximum distance */
  private layoutPose(pose: CamPose) {
    const NX = 32;
    const NY = 24;
    const pos: number[] = [];
    const uv: number[] = [];
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        const [x, y, z] = rayPoint(pose, (-1 + (2 * i) / NX) * this.aspect, -1 + (2 * j) / NY, WALL_M);
        // unit of the scene is DIST_M metres, the local frame has y north: the heading is applied by the matrix
        pos.push(x / DIST_M, y / DIST_M, z / DIST_M);
        uv.push(i / NX, j / NY);
      }
    const index: number[] = [];
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        index.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.board.geometry.dispose();
    this.board.geometry = geo;
    this.board.position.set(0, 0, 0);
    this.board.scale.set(1, 1, 1);
    // the edge of the picture and the four rays from the camera to its corners
    const at = (i: number, j: number) => {
      const k = (j * (NX + 1) + i) * 3;
      return [pos[k], pos[k + 1], pos[k + 2]];
    };
    const edge: number[][] = [];
    for (let i = 0; i < NX; i++) edge.push(at(i, 0), at(i + 1, 0), at(i, NY), at(i + 1, NY));
    for (let j = 0; j < NY; j++) edge.push(at(0, j), at(0, j + 1), at(NX, j), at(NX, j + 1));
    for (const [i, j] of [[0, 0], [NX, 0], [NX, NY], [0, NY]]) edge.push([0, 0, 0], at(i, j));
    this.frame.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edge.flat(), 3));
    this.frame.geometry.computeBoundingSphere();
  }

  show(map: MlMap, view: CamView) {
    this.map = map;
    if (!map.getLayer(this.id)) map.addLayer(this);
    this.view = view;
    this.layout();
    this.setTexture(view.video ?? null, view.image);
    this.group.visible = true;
    clearInterval(this.watch);
    this.watch = window.setInterval(() => this.check(), 1000);
    map.triggerRepaint();
  }

  hide() {
    clearInterval(this.watch);
    this.view = null;
    this.group.visible = false;
    this.setTexture(null);
    this.map?.triggerRepaint();
  }

  private check() {
    const v = this.view;
    if (!v) return;
    if (!v.anchor.isConnected || v.anchor.hidden) return this.hide();
    // the stream failed and the popup fell back to the still image
    if (v.video && !v.video.isConnected) {
      v.video = undefined;
      this.setTexture(null, v.image);
    }
  }

  private setTexture(video: HTMLVideoElement | null, image?: string) {
    this.texture?.dispose();
    this.texture = null;
    const mat = this.board.material;
    const apply = (tex: THREE.Texture, w: number, h: number) => {
      if (this.texture !== tex) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.opacity = 1;
      mat.needsUpdate = true;
      if (w > 0 && h > 0) {
        this.aspect = w / h;
        this.layout();
      }
      this.map?.triggerRepaint();
    };
    mat.map = null;
    mat.color.set(0x0b1a1a);
    mat.opacity = 0.85;
    mat.needsUpdate = true;
    if (video) {
      const tex = new THREE.VideoTexture(video);
      this.texture = tex;
      const ready = () => {
        // a natively playing cross-origin stream cannot be drawn by WebGL: show the still image instead
        if (!textureSafe(video)) {
          if (this.texture === tex && this.view) this.setTexture(null, this.view.image);
          return;
        }
        apply(tex, video.videoWidth, video.videoHeight);
      };
      if (video.readyState >= 2) ready();
      else video.addEventListener('loadeddata', ready, { once: true });
    } else if (image) {
      // without CORS on the image host the texture cannot be used: the board stays an empty frame
      const url = `${image}${image.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}`;
      const tex = new THREE.TextureLoader().setCrossOrigin('anonymous').load(
        url,
        (t) => apply(t, (t.image as HTMLImageElement).naturalWidth, (t.image as HTMLImageElement).naturalHeight),
        undefined,
        () => undefined,
      );
      this.texture = tex;
    }
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
  }

  onRemove() {
    clearInterval(this.watch);
    this.texture?.dispose();
    this.board.geometry.dispose();
    this.board.material.dispose();
    this.frame.geometry.dispose();
    (this.frame.material as THREE.Material).dispose();
    this.renderer?.dispose();
    this.renderer = undefined;
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const v = this.view;
    if (!v || !this.renderer) return;
    const map = this.map;
    // positions relative to the map centre (Float32 precision, see planes3d.ts)
    const centre = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    this.proj.fromArray(args.defaultProjectionData.mainMatrix as number[]).multiply(new THREE.Matrix4().makeTranslation(centre.x, centre.y, 0));
    const elev = map.getTerrain() ? (map.queryTerrainElevation([v.lon, v.lat]) ?? 0) : 0;
    const mc = MercatorCoordinate.fromLngLat([v.lon, v.lat], elev + (v.pose ? v.pose.alt : MOUNT_M));
    const s = mc.meterInMercatorCoordinateUnits() * DIST_M;
    // y is flipped between mercator space (south = +y) and the local frame (north = +y)
    this.group.matrix
      .makeTranslation(mc.x - centre.x, mc.y - centre.y, mc.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationZ((-v.dir * Math.PI) / 180));
    this.camera.projectionMatrix.copy(this.proj);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    // a video texture needs a new frame drawn continuously
    if (v.video && this.board.material.map === this.texture && !v.video.paused && !document.hidden) map.triggerRepaint();
  }
}
