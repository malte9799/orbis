import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import type { GeoFrame, Vec3 } from '../globe/geo3d/frame';
import { GeoLine } from '../globe/geo3d/line';
import type { GeoPart, GeoTarget } from '../globe/geo3d/stage';
import { GeoWall } from '../globe/geo3d/wall';
import { airliner } from '../globe/planes3d';

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

/** Modell mindestens so lang auf dem Bildschirm (CSS px), damit man es beim Auszoomen noch sieht */
const MIN_PX = 26;
const MODEL_LENGTH_M = 18.8;
const MARK_PX = 5;
const FLATTEN = new THREE.Matrix4().makeScale(1, 1, 0.001);

export class IncidentScene implements GeoPart {
  readonly object = new THREE.Group();
  /** so heißt die Quelle in der Adresse (follow=incident/<id>) */
  readonly source = 'incident';
  /** das Flugzeug als Ziel des Kamera-Fokus (Klick darauf folgt ihm) */
  target: GeoTarget | null = null;
  private plane = new THREE.Mesh(airliner(0.5), new THREE.MeshLambertMaterial({ color: 0xff5a4a, side: THREE.DoubleSide }));
  private shadow = new THREE.Mesh(airliner(0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  private markGeo = new THREE.SphereGeometry(1, 14, 10);
  private marks: { data: IncidentMark; mesh: THREE.Mesh }[] = [];
  /** gestrichelte Gesamtspur (auch der noch nicht geflogene Teil) */
  private full: GeoLine | null = null;
  /** geflogene Spur: eine Linie je Höhenstufe */
  private runs: { line: GeoLine; end: Vec3 }[] = [];
  private wall = new GeoWall({ color: '#ffb74d', fullM: 60000, goneM: 70000 });
  private drop: GeoLine | null = null;
  private pose: IncidentPose | null = null;
  private trailLen = 0;
  constructor(private map: MlMap) {
    for (const m of [this.plane, this.shadow]) m.matrixAutoUpdate = false;
    this.object.add(this.shadow, this.plane, this.wall.object);
    this.wall.setStyle(0.28, 0);
  }

  /** Gesamte Spur [lon, lat, m über Grund] für die gestrichelte Linie */
  setFullTrack(pts: Vec3[]) {
    if (this.full) {
      this.object.remove(this.full.object);
      this.full.dispose();
      this.full = null;
    }
    if (pts.length > 1) {
      this.full = new GeoLine(pts, { color: '#ffffff', width: 1.5, opacity: 0.75, dash: [5, 4] });
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
      return { data, mesh };
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
      let cur = bandColor(((pts[0][2] + pts[1][2]) / 2) / FT);
      const flush = (end: number) => {
        const line = new GeoLine(pts.slice(start, end + 1), { color: cur.color, width: 3.2, opacity: 0.95 });
        this.object.add(line.object);
        this.runs.push({ line, end: pts[end] });
      };
      for (let i = 1; i < pts.length - 1; i++) {
        const b = bandColor(((pts[i][2] + pts[i + 1][2]) / 2) / FT);
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
        this.drop = new GeoLine(pts, { color: '#ffffff', width: 1, opacity: 0.45 });
        this.object.add(this.drop.object);
      }
    }
    this.map.triggerRepaint();
  }

  targets(): GeoTarget[] {
    return this.target && this.pose ? [this.target] : [];
  }

  private lift(lon: number, lat: number) {
    return this.map.getTerrain() ? (this.map.queryTerrainElevation([lon, lat]) ?? 0) : 0;
  }

  update(frame: GeoFrame, now: number) {
    const p = this.pose;
    const lift = p ? this.lift(p.lon, p.lat) : 0;
    this.plane.visible = this.shadow.visible = !!p && !frame.occluded(p.lon, p.lat, p.altM + lift);
    if (p) {
      const mpp = frame.metresPerPixel(p.lon, p.lat, p.altM + lift);
      const scale = Math.max(1, (MIN_PX * mpp) / MODEL_LENGTH_M);
      frame.place(this.plane.matrix, p.lon, p.lat, p.altM + lift, p.track, scale).multiply(new THREE.Matrix4().makeRotationX(rad(p.pitch)));
      frame.place(this.shadow.matrix, p.lon, p.lat, lift + 0.5, p.track, scale).multiply(FLATTEN);
    }
    for (const r of this.runs) r.line.update(frame, now, lift);
    if (this.drop) {
      if (p) this.drop.update(frame, now, lift);
      else this.drop.object.visible = false;
    }
    this.full?.update(frame, now, lift);
    if (this.trailLen > 1) this.wall.update(frame, now, lift);
    for (const { data: d, mesh } of this.marks) {
      mesh.visible = !frame.occluded(d.lon, d.lat, d.altM + lift);
      frame.place(mesh.matrix, d.lon, d.lat, d.altM + lift, 0, MARK_PX * frame.metresPerPixel(d.lon, d.lat, d.altM + lift));
    }
    return false;
  }

  dispose() {
    this.full?.dispose();
    this.drop?.dispose();
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
