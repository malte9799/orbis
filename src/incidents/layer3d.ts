import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import type { GeoFrame, Vec3 } from '../globe/geo3d/frame';
import { GeoLine } from '../globe/geo3d/line';
import type { GeoPart, GeoTarget } from '../globe/geo3d/stage';
import { GeoWall } from '../globe/geo3d/wall';
import { airliner } from '../globe/planes3d';
import type { IncidentKind } from './types';

// 3D der Rekonstruktion als Teil der GeoStage (src/globe/geo3d): Flugzeugmodell, geflogene Spur nach Höhe eingefärbt, Wand zum
// Boden, gestrichelte Gesamtspur, Linie und Schatten unter dem Flugzeug und Ereignismarken in Spurhöhe. Alles ist nach Länge,
// Breite und Höhe platziert, also gilt es bei jedem Zoom und in jeder Projektion. Die Neigung ist aus der Bahn abgeleitet.

const FT = 0.3048;
const rad = (d: number) => (d * Math.PI) / 180;

export interface IncidentPose {
  lon: number;
  lat: number;
  /** m über Grund */
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
  /** woher die Marke kommt: Ereignis oder Video (Index in der Liste des Ereignisses) – für Hover und Klick */
  ref?: { kind: 'event' | 'media'; i: number };
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
const BANDS = 10;
/** Farbe nach Höhe in ft, in BANDS Stufen (jede Stufe ist eine eigene Linie) */
function bandColor(ft: number): { band: number; color: string } {
  const f = Math.max(0, Math.min(41000, ft));
  const band = Math.min(BANDS - 1, Math.floor((f / 41000) * BANDS));
  const mid = ((band + 0.5) / BANDS) * 41000;
  const c = new THREE.Color();
  for (let i = 1; i < STOPS.length; i++) {
    if (mid <= STOPS[i][0]) {
      c.setHex(STOPS[i - 1][1]).lerp(new THREE.Color(STOPS[i][1]), (mid - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]));
      return { band, color: `#${c.getHexString()}` };
    }
  }
  return { band, color: '#ef5350' };
}

const DEPTH_STOPS: [number, number][] = [[0, 0x4fc3f7], [1000, 0x29b6f6], [2500, 0x3f51b5], [3800, 0x4a148c]];
const DEPTH_MAX = 3800;
/** Farbe nach Tiefe in m (positiv), in BANDS Stufen */
function depthColor(depthM: number): { band: number; color: string } {
  const f = Math.max(0, Math.min(DEPTH_MAX, depthM));
  const band = Math.min(BANDS - 1, Math.floor((f / DEPTH_MAX) * BANDS));
  const mid = ((band + 0.5) / BANDS) * DEPTH_MAX;
  const c = new THREE.Color();
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    if (mid <= DEPTH_STOPS[i][0]) {
      c.setHex(DEPTH_STOPS[i - 1][1]).lerp(new THREE.Color(DEPTH_STOPS[i][1]), (mid - DEPTH_STOPS[i - 1][0]) / (DEPTH_STOPS[i][0] - DEPTH_STOPS[i - 1][0]));
      return { band, color: `#${c.getHexString()}` };
    }
  }
  return { band, color: '#4a148c' };
}

/** Tauchboot (Titan: 6,7 m lang, 2,8 m breit): Kapsel, Nase nach +y, Mittelpunkt im Ursprung */
function submersibleGeometry(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(1.25, 4.2, 6, 16);
  g.scale(1, 1, 0.9);
  return g;
}

/** Schiff (Polar Prince: 67 m lang), Bug nach +y, Kiel auf z = 0 */
function shipGeometry(): THREE.BufferGeometry {
  const hull = new THREE.Shape();
  hull.moveTo(-7, -33).lineTo(7, -33).lineTo(7, 16).lineTo(0, 33).lineTo(-7, 16).closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 7, bevelEnabled: false });
  const house = new THREE.BoxGeometry(11, 14, 7).translate(0, -10, 10.5);
  const merged = new THREE.BufferGeometry();
  const parts = [hullGeo.toNonIndexed(), house.toNonIndexed()];
  const pos = parts.flatMap((p) => Array.from(p.getAttribute('position').array));
  const nor = parts.flatMap((p) => Array.from(p.getAttribute('normal').array));
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return merged;
}

/** Modell mindestens so lang auf dem Bildschirm (CSS px), damit man es beim Auszoomen noch sieht */
const MIN_PX = 26;
const MODEL_LENGTH_M = 18.8;
const SUB_LENGTH_M = 6.7;
const SHIP_LENGTH_M = 67;
const MARK_PX = 5;
/** Wand: unter diesem Kartenmaßstab (m pro Pixel in der Bildmitte) ganz weg, über dem zweiten voll da (Zoom 12 ≈ 30 m/px, Zoom 10 ≈ 120 m/px) */
const WALL_NEAR_M = 40;
const WALL_FAR_M = 120;
const WALL_OPACITY = 0.28;
const FLATTEN = new THREE.Matrix4().makeScale(1, 1, 0.001);

export class IncidentScene implements GeoPart {
  readonly object = new THREE.Group();
  /** so heißt die Quelle in der Adresse (follow=incident/<id>) */
  readonly source = 'incident';
  /** das Flugzeug als Ziel des Kamera-Fokus (Klick darauf folgt ihm) */
  target: GeoTarget | null = null;
  private plane: THREE.Mesh;
  private shadow: THREE.Mesh;
  /** Begleitschiff (nur wenn das Ereignis eins hat) und seine Route */
  private ship: THREE.Mesh | null = null;
  private shipPose: { lon: number; lat: number; track: number } | null = null;
  private route: GeoLine | null = null;
  /** Tauchboot: Spur unter Wasser, durch den Globus hindurch sichtbar */
  private sub: boolean;
  private markGeo = new THREE.SphereGeometry(1, 14, 10);
  private marks: { data: IncidentMark; mesh: THREE.Mesh; screen: [number, number] | null }[] = [];
  /** gestrichelte Gesamtspur (auch der noch nicht geflogene Teil) */
  private full: GeoLine | null = null;
  /** geflogene Spur: eine Linie je Höhenstufe */
  private runs: { line: GeoLine; end: Vec3 }[] = [];
  private wall: GeoWall;
  private drop: GeoLine | null = null;
  private pose: IncidentPose | null = null;
  private trailLen = 0;
  constructor(private map: MlMap, kind: IncidentKind = 'aircraft') {
    this.sub = kind === 'submersible';
    this.plane = new THREE.Mesh(
      this.sub ? submersibleGeometry() : airliner(0.5),
      new THREE.MeshLambertMaterial({ color: this.sub ? 0xfff59d : 0xff5a4a, side: THREE.DoubleSide }),
    );
    this.shadow = new THREE.Mesh(airliner(0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.wall = new GeoWall({ color: this.sub ? '#4fc3f7' : '#ffb74d', fullM: 60000, goneM: 70000, seeThrough: this.sub });
    for (const m of [this.plane, this.shadow]) m.matrixAutoUpdate = false;
    this.object.add(this.shadow, this.plane, this.wall.object);
    this.wall.setStyle(WALL_OPACITY, 0);
  }

  /** Gesamte Spur [lon, lat, m über Grund] für die gestrichelte Linie */
  setFullTrack(pts: Vec3[]) {
    if (this.full) {
      this.object.remove(this.full.object);
      this.full.dispose();
      this.full = null;
    }
    if (pts.length > 1) {
      this.full = new GeoLine(pts, { color: '#ffffff', width: 1.5, opacity: 0.75, dash: [5, 4], seeThrough: this.sub });
      this.object.add(this.full.object);
    }
    this.map.triggerRepaint();
  }

  /** Ereignismarken (ersetzt die bisherigen); sie schweben in der Höhe der Spur */
  setMarks(list: IncidentMark[]) {
    for (const m of this.marks) {
      this.object.remove(m.mesh);
      (m.mesh.material as THREE.Material).dispose();
    }
    this.marks = list.map((data) => {
      const mesh = new THREE.Mesh(this.markGeo, new THREE.MeshBasicMaterial({ color: data.color }));
      mesh.matrixAutoUpdate = false;
      this.object.add(mesh);
      return { data, mesh, screen: null };
    });
    this.map.triggerRepaint();
  }

  /** Bisher geflogene Spur [lon, lat, m]; der letzte Punkt ist das Flugzeug. Aufrufen, wenn ein Punkt dazukommt. */
  setTrail(pts: Vec3[]) {
    for (const r of this.runs) {
      this.object.remove(r.line.object);
      r.line.dispose();
    }
    this.runs = [];
    this.trailLen = pts.length;
    if (pts.length > 1) {
      // aufeinanderfolgende Teilstücke gleicher Höhenstufe werden eine Linie; der Endpunkt gehört auch zur nächsten
      let start = 0;
      const band = (a: Vec3, b: Vec3) => (this.sub ? depthColor(-(a[2] + b[2]) / 2) : bandColor((a[2] + b[2]) / 2 / FT));
      let cur = band(pts[0], pts[1]);
      const flush = (end: number) => {
        const line = new GeoLine(pts.slice(start, end + 1), { color: cur.color, width: 3.2, opacity: 0.95, seeThrough: this.sub });
        this.object.add(line.object);
        this.runs.push({ line, end: pts[end] });
      };
      for (let i = 1; i < pts.length - 1; i++) {
        const b = band(pts[i], pts[i + 1]);
        if (b.band !== cur.band) {
          flush(i);
          start = i;
          cur = b;
        }
      }
      flush(pts.length - 1);
      this.wall.setPoints(pts, pts.map(() => 0));
    }
    this.map.triggerRepaint();
  }

  /** Zustand zur Wiedergabezeit (null: Flugzeug nicht zeigen) */
  setPose(pose: IncidentPose | null) {
    this.pose = pose;
    if (pose && this.trailLen > 1) {
      const head: Vec3 = [pose.lon, pose.lat, pose.altM];
      this.runs.at(-1)?.line.setHead(head);
      this.wall.setHead(head);
    }
    if (pose) {
      const pts: Vec3[] = [[pose.lon, pose.lat, pose.altM], [pose.lon, pose.lat, 0]];
      if (this.drop) this.drop.setPoints(pts);
      else {
        this.drop = new GeoLine(pts, { color: '#ffffff', width: 1, opacity: 0.45, seeThrough: this.sub });
        this.object.add(this.drop.object);
      }
    }
    this.map.triggerRepaint();
  }

  /** Route des Begleitschiffs [lon, lat] (dünne Linie auf dem Wasser) */
  setShipRoute(pts: Vec3[]) {
    if (this.route) {
      this.object.remove(this.route.object);
      this.route.dispose();
      this.route = null;
    }
    if (!this.ship) {
      this.ship = new THREE.Mesh(shipGeometry(), new THREE.MeshLambertMaterial({ color: 0xef5350, side: THREE.DoubleSide }));
      this.ship.matrixAutoUpdate = false;
      this.ship.visible = false;
      this.object.add(this.ship);
    }
    if (pts.length > 1) {
      this.route = new GeoLine(pts, { color: '#ffcc80', width: 1.6, opacity: 0.85, dash: [6, 4] });
      this.object.add(this.route.object);
    }
    this.map.triggerRepaint();
  }

  /** Das Schiff zur Wiedergabezeit (null: nicht zeigen) */
  setShipPose(pose: { lon: number; lat: number; track: number } | null) {
    this.shipPose = pose;
    this.map.triggerRepaint();
  }

  targets(): GeoTarget[] {
    return this.target && this.pose ? [this.target] : [];
  }

  /** Die Marke unter einem Bildschirmpunkt (CSS px, im Abstand von höchstens `radius`); die nächste gewinnt. */
  markAt(x: number, y: number, radius = MARK_PX + 7): (IncidentMark & { screen: [number, number] }) | null {
    let best: (IncidentMark & { screen: [number, number] }) | null = null;
    let bestD = radius;
    for (const { data, screen } of this.marks) {
      if (!screen) continue;
      const d = Math.hypot(screen[0] - x, screen[1] - y);
      if (d <= bestD) {
        best = { ...data, screen };
        bestD = d;
      }
    }
    return best;
  }

  /** Bildschirmposition (CSS px) der Marke mit dieser Herkunft im zuletzt gezeichneten Bild; null: nicht zu sehen */
  screenOf(ref: NonNullable<IncidentMark['ref']>): [number, number] | null {
    return this.marks.find((m) => m.data.ref?.kind === ref.kind && m.data.ref.i === ref.i)?.screen ?? null;
  }

  private lift(lon: number, lat: number) {
    return this.map.getTerrain() ? (this.map.queryTerrainElevation([lon, lat]) ?? 0) : 0;
  }

  update(frame: GeoFrame, now: number) {
    const p = this.pose;
    const lift = p ? this.lift(p.lon, p.lat) : 0;
    // Tauchboot: nur verborgen, wenn die Wasseroberfläche darüber hinter dem Horizont liegt (der Globus selbst verdeckt es nicht)
    this.plane.visible = !!p && !frame.occluded(p.lon, p.lat, this.sub ? 0 : p.altM + lift);
    this.shadow.visible = this.plane.visible && !this.sub;
    if (p) {
      const mpp = frame.metresPerPixel(p.lon, p.lat, p.altM + lift);
      const scale = Math.max(1, (MIN_PX * mpp) / (this.sub ? SUB_LENGTH_M : MODEL_LENGTH_M));
      frame.place(this.plane.matrix, p.lon, p.lat, p.altM + lift, p.track, scale).multiply(new THREE.Matrix4().makeRotationX(rad(p.pitch)));
      if (!this.sub) frame.place(this.shadow.matrix, p.lon, p.lat, lift + 0.5, p.track, scale).multiply(FLATTEN);
    }
    if (this.ship) {
      const sp = this.shipPose;
      this.ship.visible = !!sp && !frame.occluded(sp.lon, sp.lat, 0);
      if (sp && this.ship.visible) {
        const scale = Math.max(1, (MIN_PX * frame.metresPerPixel(sp.lon, sp.lat, 0)) / SHIP_LENGTH_M);
        frame.place(this.ship.matrix, sp.lon, sp.lat, 0, sp.track, scale);
      }
    }
    this.route?.update(frame, now, 0);
    for (const r of this.runs) r.line.update(frame, now, lift);
    if (this.drop) {
      if (p) this.drop.update(frame, now, lift);
      else this.drop.object.visible = false;
    }
    this.full?.update(frame, now, lift);
    // Die Wand reicht vom Flugzeug (10 km hoch) bis zum Boden. Steht die Kamera niedrig (flache Karte, Zoom 12 und mehr), überspannt sie
    // den ganzen Bildschirm, und ihre 500 Teilstücke übereinander blenden die Grafikkarte tot (die Seite hängt). Deshalb nach dem
    // Maßstab der Karte ausblenden – nicht nach dem Abstand zum Flugzeug, der bei hoch fliegenden Flugzeugen immer groß ist.
    const share = Math.max(0, Math.min(1, (frame.centreMetresPerPixel - WALL_NEAR_M) / (WALL_FAR_M - WALL_NEAR_M)));
    this.wall.object.visible = this.trailLen > 1 && share > 0;
    if (this.wall.object.visible) {
      this.wall.setStyle(WALL_OPACITY * share, 0);
      this.wall.update(frame, now, lift);
    }
    for (const m of this.marks) {
      const { data: d, mesh } = m;
      mesh.visible = !frame.occluded(d.lon, d.lat, this.sub ? 0 : d.altM + lift);
      m.screen = mesh.visible ? (this.sub ? frame.toScreenBelow(d.lon, d.lat, d.altM + lift) : frame.toScreen(d.lon, d.lat, d.altM + lift)) : null;
      frame.place(mesh.matrix, d.lon, d.lat, d.altM + lift, 0, MARK_PX * frame.metresPerPixel(d.lon, d.lat, d.altM + lift));
    }
    return false;
  }

  dispose() {
    this.full?.dispose();
    this.drop?.dispose();
    this.route?.dispose();
    if (this.ship) {
      this.ship.geometry.dispose();
      (this.ship.material as THREE.Material).dispose();
    }
    for (const r of this.runs) r.line.dispose();
    this.wall.dispose();
    this.plane.geometry.dispose();
    this.shadow.geometry.dispose();
    this.markGeo.dispose();
    (this.plane.material as THREE.Material).dispose();
    (this.shadow.material as THREE.Material).dispose();
    for (const m of this.marks) (m.mesh.material as THREE.Material).dispose();
  }
}
