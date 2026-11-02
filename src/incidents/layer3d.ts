import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';
import { airliner } from '../globe/planes3d';
import { GLOBE_FLAT_ZOOM } from '../globe/style';

// 3D-Flugzeug der Rekonstruktion: eigene three.js-Ebene im GL-Kontext von MapLibre (wie planes3d). Gezeigt werden
// das Modell an der Stelle der Spur zur Wiedergabezeit, die bisher geflogene Spur in echter Höhe, eine Linie zum
// Boden und der Schatten. Die Neigung ist aus Sinkrate und Geschwindigkeit abgeleitet.

const FT = 0.3048;
const rad = (d: number) => (d * Math.PI) / 180;

export interface IncidentPose {
  lon: number;
  lat: number;
  /** m über Grund; null: Flugzeug nicht zeigen (z. B. nach dem Ende der Spur) */
  altM: number;
  /** Kurs in ° */
  track: number;
  /** Nickwinkel in ° (positiv: Nase oben) */
  pitch: number;
}

/** Ereignismarke in der Luft (Kugel an der Stelle der Spur zur Zeit des Ereignisses) */
export interface IncidentMark {
  lon: number;
  lat: number;
  altM: number;
  color: number;
}

export const ftToM = (ft: number) => ft * FT;

/** Nickwinkel aus Steig-/Sinkrate (ft/min) und Groundspeed (kn); begrenzt auf ±85° */
export function pitchOf(vsFpm: number | null, gsKn: number): number {
  if (vsFpm == null) return 0;
  const vz = (vsFpm * FT) / 60;
  const vh = Math.max(gsKn * 0.514444, 1);
  return Math.max(-85, Math.min(85, (Math.atan2(vz, vh) * 180) / Math.PI));
}

const STOPS: [number, number][] = [[0, 0x29b6f6], [15000, 0x66bb6a], [30000, 0xffca28], [41000, 0xef5350]];
/** Farbe nach Höhe in ft – dieselbe Skala wie die Spur auf der flachen Karte */
function altColor(ft: number, out: THREE.Color): THREE.Color {
  const f = Math.max(0, Math.min(41000, ft));
  for (let i = 1; i < STOPS.length; i++) {
    if (f <= STOPS[i][0]) {
      const k = (f - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]);
      return out.setHex(STOPS[i - 1][1]).lerp(new THREE.Color(STOPS[i][1]), k);
    }
  }
  return out.setHex(STOPS[STOPS.length - 1][1]);
}

export class IncidentLayer implements CustomLayerInterface {
  readonly id = 'incident3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private plane = new THREE.Mesh(airliner(0.5), new THREE.MeshLambertMaterial({ color: 0xff5a4a, side: THREE.DoubleSide }));
  private shadow = new THREE.Mesh(airliner(0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  private drop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
  private trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true }));
  /** senkrechte Wand von der Spur zum Boden, nach Höhe eingefärbt – macht die Höhe lesbar */
  private wall = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  private markGeo = new THREE.SphereGeometry(1, 14, 10);
  private marks: { data: IncidentMark; mesh: THREE.Mesh }[] = [];
  /** gesamte Spur (auch der noch nicht geflogene Teil) als gestrichelte Linie in echter Höhe */
  private full = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, dashSize: 1, gapSize: 1 }));
  private fullPts: [number, number, number][] = [];
  private proj = new THREE.Matrix4();
  private pose: IncidentPose | null = null;
  /** Bildschirmposition (CSS px) des Modells im zuletzt gezeichneten Bild, null ohne Modell */
  private screenPos: [number, number] | null = null;
  /** bisher geflogene Spur [lon, lat, altM] */
  private trail: [number, number, number][] = [];

  constructor() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0.4, -0.6, 1);
    this.scene.add(sun);
    this.plane.matrixAutoUpdate = false;
    this.shadow.matrixAutoUpdate = false;
    this.trailLine.frustumCulled = false;
    this.drop.frustumCulled = false;
    this.wall.frustumCulled = false;
    this.full.frustumCulled = false;
    this.scene.add(this.full);
    this.scene.add(this.plane, this.shadow, this.drop, this.trailLine, this.wall);
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
  }

  onRemove() {
    this.renderer?.dispose();
    this.plane.geometry.dispose();
    this.shadow.geometry.dispose();
    this.drop.geometry.dispose();
    this.trailLine.geometry.dispose();
    this.wall.geometry.dispose();
    this.wall.material.dispose();
    this.markGeo.dispose();
    this.full.geometry.dispose();
    this.full.material.dispose();
    for (const m of this.marks) (m.mesh.material as THREE.Material).dispose();
  }

  /** Gesamte Spur [lon, lat, m über Grund] für die gestrichelte Linie */
  setFullTrack(pts: [number, number, number][]) {
    this.fullPts = pts;
    this.map?.triggerRepaint();
  }

  /** Ereignismarken (ersetzt die bisherigen); sie schweben in der Höhe der Spur */
  setMarks(list: IncidentMark[]) {
    for (const m of this.marks) {
      this.scene.remove(m.mesh);
      (m.mesh.material as THREE.Material).dispose();
    }
    this.marks = list.map((data) => {
      const mesh = new THREE.Mesh(this.markGeo, new THREE.MeshBasicMaterial({ color: data.color }));
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      return { data, mesh };
    });
    this.map?.triggerRepaint();
  }

  /** Zustand zur Wiedergabezeit; trail = bisher geflogene Punkte (null: unverändert lassen) */
  set(pose: IncidentPose | null, trail?: [number, number, number][]) {
    this.pose = pose;
    if (trail) {
      this.trail = trail;
    }
    this.map?.triggerRepaint();
  }

  /** Verschiebung in px, die das Modell in die Kartenmitte bringt (null: noch nicht gezeichnet) */
  offsetToCentre(): [number, number] | null {
    if (!this.screenPos) return null;
    const c = this.map.project(this.map.getCenter());
    return [this.screenPos[0] - c.x, this.screenPos[1] - c.y];
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number>; fallbackMatrix?: ArrayLike<number> } }) {
    const map = this.map;
    // Im Globus-Modus ist mainMatrix keine Mercator-Matrix (x/y verschieden skaliert) – das Modell läge und fände sich
    // nicht wieder. fallbackMatrix ist die Mercator-Matrix; solange der Globus noch eine Kugel ist (Zoom < GLOBE_FLAT_ZOOM)
    // passt auch sie nicht zur Karte, dann zeigen wir nichts.
    const ball = map.getProjection()?.type === 'globe' && map.getZoom() < GLOBE_FLAT_ZOOM;
    this.screenPos = null;
    if (ball) {
      this.renderer.resetState();
      return;
    }
    const matrix = args.defaultProjectionData.fallbackMatrix ?? args.defaultProjectionData.mainMatrix;
    // wie in planes3d: alles relativ zur Kartenmitte, sonst zittern Metermodelle bei hohem Zoom (Float32)
    const centre = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    this.proj.fromArray(matrix as number[]).multiply(new THREE.Matrix4().makeTranslation(centre.x, centre.y, 0));
    const p = this.pose;
    const terrain = map.getTerrain();
    const elev = (lon: number, lat: number) => (terrain ? (map.queryTerrainElevation([lon, lat]) ?? 0) : 0);
    this.plane.visible = this.shadow.visible = this.drop.visible = !!p;
    this.screenPos = null;
    if (p) {
      const g = elev(p.lon, p.lat);
      const at = MercatorCoordinate.fromLngLat([p.lon, p.lat], p.altM + g);
      const v = new THREE.Vector4(at.x - centre.x, at.y - centre.y, at.z, 1).applyMatrix4(this.proj);
      if (v.w > 0) {
        const canvas = map.getCanvas();
        this.screenPos = [(v.x / v.w * 0.5 + 0.5) * canvas.clientWidth, (1 - (v.y / v.w * 0.5 + 0.5)) * canvas.clientHeight];
      }
      // Modell nie kleiner als ~26 px lang, damit man es beim Auszoomen noch sieht
      const mpp = (40075016 * Math.cos(rad(map.getCenter().lat))) / (512 * 2 ** map.getZoom());
      const boost = Math.max(1, 0.65 * mpp);
      const place = (alt: number) => {
        const mc = MercatorCoordinate.fromLngLat([p.lon, p.lat], alt);
        const s = mc.meterInMercatorCoordinateUnits() * boost;
        // y ist zwischen Mercator (Süden = +y) und Modell (Norden = +y) gespiegelt
        return new THREE.Matrix4().makeTranslation(mc.x - centre.x, mc.y - centre.y, mc.z).scale(new THREE.Vector3(s, -s, s));
      };
      // Modell: y = vorn, z = oben. Kurs um z, Nick um x
      this.plane.matrix.copy(place(p.altM + g).multiply(new THREE.Matrix4().makeRotationZ(-rad(p.track))).multiply(new THREE.Matrix4().makeRotationX(rad(p.pitch))));
      // Schatten: gleiche Form flach auf dem Boden
      const mcg = MercatorCoordinate.fromLngLat([p.lon, p.lat], g + 0.5);
      const sg = mcg.meterInMercatorCoordinateUnits() * boost;
      this.shadow.matrix
        .makeTranslation(mcg.x - centre.x, mcg.y - centre.y, mcg.z)
        .scale(new THREE.Vector3(sg, -sg, sg * 0.001))
        .multiply(new THREE.Matrix4().makeRotationZ(-rad(p.track)));
      const a = MercatorCoordinate.fromLngLat([p.lon, p.lat], p.altM + g);
      this.drop.geometry.setFromPoints([new THREE.Vector3(a.x - centre.x, a.y - centre.y, a.z), new THREE.Vector3(a.x - centre.x, a.y - centre.y, mcg.z)]);
    }
    // gestrichelte Gesamtspur: Strichlänge in Pixeln, also je Bild neu in Mercator-Einheiten
    const upx = MercatorCoordinate.fromLngLat(map.getCenter(), 0).meterInMercatorCoordinateUnits() * (40075016 * Math.cos(rad(map.getCenter().lat))) / (512 * 2 ** map.getZoom());
    const fp = new Float32Array(this.fullPts.length * 3);
    this.fullPts.forEach(([lon, lat, altM], i) => {
      const mc = MercatorCoordinate.fromLngLat([lon, lat], altM + elev(lon, lat));
      fp.set([mc.x - centre.x, mc.y - centre.y, mc.z], i * 3);
    });
    this.full.geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.full.computeLineDistances();
    const dm = this.full.material as THREE.LineDashedMaterial;
    dm.dashSize = upx * 7;
    dm.gapSize = upx * 6;
    // Ereignismarken: immer ~5 px groß, egal wie weit herausgezoomt
    const mppM = (40075016 * Math.cos(rad(map.getCenter().lat))) / (512 * 2 ** map.getZoom());
    for (const { data: d, mesh } of this.marks) {
      const mc = MercatorCoordinate.fromLngLat([d.lon, d.lat], d.altM + elev(d.lon, d.lat));
      const r = mc.meterInMercatorCoordinateUnits() * mppM * 5;
      mesh.matrix.makeTranslation(mc.x - centre.x, mc.y - centre.y, mc.z).scale(new THREE.Vector3(r, r, r));
    }
    // Spur und Wand: bei jedem Bild neu relativ zur Mitte (Mitte ändert sich), es sind nur wenige hundert Punkte
    const n = this.trail.length;
    const line = new Float32Array(n * 3);
    const wall = new Float32Array(n * 6);
    const col = new Float32Array(n * 3);
    const wcol = new Float32Array(n * 6);
    const c = new THREE.Color();
    this.trail.forEach(([lon, lat, altM], i) => {
      const g = elev(lon, lat);
      const mc = MercatorCoordinate.fromLngLat([lon, lat], altM + g);
      const gz = MercatorCoordinate.fromLngLat([lon, lat], g).z;
      line.set([mc.x - centre.x, mc.y - centre.y, mc.z], i * 3);
      wall.set([mc.x - centre.x, mc.y - centre.y, mc.z, mc.x - centre.x, mc.y - centre.y, gz], i * 6);
      altColor(altM / FT, c);
      col.set([c.r, c.g, c.b], i * 3);
      wcol.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    const lg = this.trailLine.geometry;
    lg.setAttribute('position', new THREE.BufferAttribute(line, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    lg.setDrawRange(0, n);
    const wg = this.wall.geometry;
    wg.setAttribute('position', new THREE.BufferAttribute(wall, 3));
    wg.setAttribute('color', new THREE.BufferAttribute(wcol, 3));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    wg.setIndex(idx);
    this.camera.projectionMatrix = this.proj;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }
}
