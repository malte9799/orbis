// Snapshot der Angemeldeten Versammlungen D/AT/CH (demonstrations.org, Demos Berlin e.V.,
// CC BY-SA 4.0): Die API spiegelt behördliche Versammlungslisten als GeoJSON; Orbismap/data collectors/fetch-data.ts
// aktualisiert `demos.json` alle 15 Minuten im R2-Bucket, der Browser liest nur den Snapshot.
//
// Ein Eintrag pro Treffpunkt (mehrere Starts = mehrere Einräge): `r` ist die Rolle
// (start/waypoint/rally/end – AK/ZK/EK der Behörden). `u` verlinkt die Seite auf demonstrations.org,
// `src` auf die amtliche Quelle der Meldung.

export interface DemoEvent {
  /** Kurzname */
  n: string;
  /** Start-/Endzeit (ISO, lokale Zeitzone des Orts) */
  s: string;
  e?: string;
  /** Land ("Deutschland", "Österreich", "Schweiz") */
  c: string;
  city: string;
  /** Treffpunkt (Straße + Zusatz, Freitext der Behörde) */
  place?: string;
  lon: number;
  lat: number;
  /** Rolle des Treffpunkts ('start'|'waypoint'|'rally'|'end') */
  r?: string;
  /** Themen (deutsche Namen) */
  topics?: string[];
  /** Veranstalter (Freitext der Quelle) */
  org?: string;
  /** erwartete Teilnehmerzahl (Freitext der Quelle) */
  est?: string;
  /** Marsch (Strecke statt Kundgebung am Punkt) */
  march?: boolean;
  /** Originalquelle der Meldung (z. B. Versammlungsbehörde) */
  src?: string;
  /** Link zur Seite auf demonstrations.org */
  u?: string;
  /** Kurzbeschreibung (Panel) */
  sd?: string;
  /** Beschreibung der Veranstalter/Behörde (Panel) */
  ds?: string;
  /** alle Treffpunkte des Eintrags (Panel): Adresse `a`, Stadt `y`, Rolle `r` */
  lc?: { a?: string; y?: string; r?: string }[];
  /** Index in `routes` des Eintrags (Panel-Karte) */
  ri?: number;
}

export interface DemoData {
  built: string;
  source: string;
  lic: string;
  events: DemoEvent[];
  routes?: number[][][];
}

const DEMOS_SITE = 'https://demonstrations.org/';

let memo: Promise<DemoData> | null = null;

export function demodata(): Promise<DemoData> {
  memo ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<DemoData>('demos.json');
  })();
  memo.catch(() => (memo = null));
  return memo;
}

export { DEMOS_SITE };
