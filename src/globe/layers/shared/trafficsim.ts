import type { Feature, FeatureCollection, LineString, MultiLineString, Polygon } from 'geojson';

// Fahrzeug-Simulation für die Verkehrsebene: Punkte, die auf Straßenlinien der Karte entlangfahren
// (Idee wie bei God's Eye View: Straßengeometrie + Tempo je Straßenklasse, bei TomTom-Schlüssel
// langsamer und dichter je nach Verkehrslage). Rein rechnerisch, ohne Karte – die Ebene füttert
// `setRoads` mit Linien und ruft `step` pro Frame auf.

export type Coord = [number, number];

export interface Road {
  key: string;
  coords: Coord[];
  /** Länge bis zum jeweiligen Stützpunkt in Metern */
  cum: number[];
  len: number;
  /** Freifluss-Tempo in m/s */
  speed: number;
  /** Verkehrslage 0..1 (1 = frei), null ohne Live-Daten */
  level: number | null;
  /** 1/-1: nur in/gegen Zeichenrichtung, 0: beide Richtungen */
  oneway: 1 | -1 | 0;
  /** Fahrzeuge pro km bei freiem Verkehr */
  perKm: number;
}

interface Car {
  road: Road;
  s: number;
  dir: 1 | -1;
  /** Streuung des Tempos um den Straßenwert */
  jitter: number;
  seg: number;
  /** Rest-Wartezeit an der Ampel in Sekunden */
  wait: number;
}

/** Zeitraffer: echte Geschwindigkeiten wirken auf Stadtzoom wie Stillstand */
export const TIME_SCALE = 1.5;
export const MAX_CARS = 2200;

const M_LAT = 110540;
const M_LNG = 111320;

export function segMeters(a: Coord, b: Coord): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180)) * M_LNG;
  const dy = (b[1] - a[1]) * M_LAT;
  return Math.hypot(dx, dy);
}

export function makeRoad(
  key: string,
  coords: Coord[],
  p: { speed: number; perKm: number; oneway: 1 | -1 | 0; level: number | null },
): Road | null {
  if (coords.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + segMeters(coords[i - 1], coords[i]));
  const len = cum[cum.length - 1];
  if (!(len > 15)) return null;
  return { key, coords, cum, len, ...p };
}

/** Linien eines GeoJSON-Features (Line/MultiLine) als Koordinatenlisten */
export function linesOf(f: Feature): Coord[][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [(g as LineString).coordinates as Coord[]];
  if (g.type === 'MultiLineString') return (g as MultiLineString).coordinates as Coord[][];
  return [];
}

export const OFM_CLASS: Record<string, { speed: number; perKm: number }> = {
  motorway: { speed: 25, perKm: 14 },
  trunk: { speed: 20, perKm: 11 },
  primary: { speed: 14, perKm: 9 },
  secondary: { speed: 11, perKm: 7 },
  tertiary: { speed: 8, perKm: 5 },
  minor: { speed: 5, perKm: 3 },
};

/** Tempo und Dichte aus TomTom `road_type` (englische Klartextnamen) */
export function tomtomClass(roadType: unknown): { speed: number; perKm: number } {
  const t = String(roadType ?? '').toLowerCase();
  if (t.includes('motorway')) return OFM_CLASS.motorway;
  if (t.includes('major')) return OFM_CLASS.primary;
  if (t.includes('secondary') || t.includes('connecting')) return OFM_CLASS.secondary;
  if (t.includes('local') || t.includes('street')) return OFM_CLASS.minor;
  return OFM_CLASS.tertiary;
}

export type Bucket = 'free' | 'slow' | 'jam';
export const bucketOf = (level: number): Bucket => (level >= 0.85 ? 'free' : level >= 0.55 ? 'slow' : 'jam');
export const BUCKET_COLOR: Record<Bucket, string> = { free: '#2ecc71', slow: '#f0b23e', jam: '#e05252' };

const speedScale = (level: number | null) => (level == null ? 1 : Math.min(1, Math.max(0.15, level)));
/** Stau = mehr Fahrzeuge auf der Strecke */
const densityScale = (level: number | null) => (level == null ? 1 : Math.min(2.5, 1 / Math.max(level, 0.4)));


export class TrafficSim {
  private cars = new Map<string, Car[]>();

  get count() {
    let n = 0;
    for (const c of this.cars.values()) n += c.length;
    return n;
  }

  /**
   * Straßen ergänzen. Vorhandene Straßen und ihre Fahrzeuge bleiben bestehen (kein Neuwürfeln beim
   * Nachladen von Kacheln); nur was `keep` verneint, wird entfernt, neue Straßen werden gefüllt.
   */
  setRoads(roads: Road[], keep: (r: Road) => boolean = () => false) {
    for (const [k, list] of this.cars) {
      const r = list[0]?.road;
      if (r && !keep(r)) this.cars.delete(k);
    }
    const incoming = new Map(roads.map((r) => [r.key, r]));
    const all = new Map<string, Road>();
    for (const [k, list] of this.cars) if (list[0]) all.set(k, list[0].road);
    for (const [k, r] of incoming) all.set(k, r);

    let total = 0;
    for (const r of all.values()) total += (r.len / 1000) * r.perKm * densityScale(r.level);
    const scale = Math.min(1, MAX_CARS / Math.max(1, total));

    for (const [k, r] of all) {
      const want = Math.round((r.len / 1000) * r.perKm * densityScale(r.level) * scale);
      const list = this.cars.get(k) ?? [];
      for (const c of list) c.road = r;
      // Hysterese: bestehende Straßen nur bei deutlicher Abweichung anpassen, sonst springen Fahrzeuge
      if (list.length > 0 && list.length >= want * 0.6 && list.length <= want * 1.6 + 1) continue;
      while (list.length > want) list.pop();
      while (list.length < want) {
        const dir: 1 | -1 = r.oneway || (list.length % 2 === 0 ? 1 : -1);
        list.push({ road: r, s: Math.random() * r.len, dir, jitter: 0.8 + Math.random() * 0.4, seg: 0, wait: 0 });
      }
      this.cars.set(k, list);
    }
  }

  clear() {
    this.cars.clear();
  }

  /** `dt` in echten Sekunden */
  step(dt: number) {
    const t = Math.min(dt, 0.1) * TIME_SCALE;
    for (const list of this.cars.values()) {
      for (const c of list) {
        if (c.wait > 0) {
          c.wait -= t;
          continue;
        }
        c.s += c.dir * c.road.speed * speedScale(c.road.level) * c.jitter * t;
        if (c.s >= c.road.len || c.s <= 0) {
          // Straßenende: als neues Fahrzeug am Anfang wieder einsetzen, an Kreuzungen kurz warten
          c.s = c.dir > 0 ? 0 : c.road.len;
          c.seg = 0;
          if (Math.random() < 0.3) c.wait = 2 + Math.random() * 5;
        }
      }
    }
  }

  /**
   * Fahrzeuge als kleine Quader (fill-extrusion), damit Gebäude sie per Tiefentest verdecken.
   * `mpp` = Meter pro Pixel auf dem Bildschirm: aus der Ferne wachsen die Quader mit, damit sie sichtbar bleiben.
   */
  toGeoJSON(mpp = 0): FeatureCollection<Polygon> {
    const features: Feature<Polygon>[] = [];
    const len = Math.max(4.5, mpp * 6);
    for (const list of this.cars.values()) {
      for (const c of list) {
        const r = c.road;
        let i = Math.min(c.seg, r.coords.length - 2);
        while (i > 0 && r.cum[i] > c.s) i--;
        while (i < r.coords.length - 2 && r.cum[i + 1] < c.s) i++;
        c.seg = i;
        const a = r.coords[i];
        const b = r.coords[i + 1];
        const span = r.cum[i + 1] - r.cum[i] || 1;
        const f = Math.min(1, Math.max(0, (c.s - r.cum[i]) / span));
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        // Fahrtrichtung in Metern (Ost/Nord), dann Rechteck um den Mittelpunkt
        const mLng = M_LNG * Math.cos(y * (Math.PI / 180));
        let ux = (b[0] - a[0]) * mLng * c.dir;
        let uy = (b[1] - a[1]) * M_LAT * c.dir;
        const n = Math.hypot(ux, uy) || 1;
        ux /= n;
        uy /= n;
        const fade = Math.min(1, Math.min(c.s, r.len - c.s) / 40);
        const hl = (len / 2) * fade;
        const hw = (len * 0.22) * fade;
        const pt = (al: number, aw: number): Coord => [x + (ux * al - uy * aw) / mLng, y + (uy * al + ux * aw) / M_LAT];
        features.push({
          type: 'Feature',
          properties: { c: r.level == null ? '#ffffff' : BUCKET_COLOR[bucketOf(r.level)], h: Math.max(1.4, len * 0.3) * fade },
          geometry: { type: 'Polygon', coordinates: [[pt(hl, hw), pt(hl, -hw), pt(-hl, -hw), pt(-hl, hw), pt(hl, hw)]] },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }
}
