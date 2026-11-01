import type { Feature, Point } from 'geojson';
import { viaProxy } from './proxy';

// Kriegsdokumentation des Archive Genocide (archivegenocide.com): die Geolocation-Map des Archivs
// baut auf offenen statischen JSON-Dateien. Exakte GPS-Pins und externe Verortungen werden als
// klickbare Punkte gezeigt, approximierte Ortsangaben nur als Heatmap (Regel des Archivs: ein
// Ortsname wird nie als exakter Punkt gezeichnet). Inhalts-links führen zur Archivseite und zum
// Original-Post, es wird kein Bild/Video inline gezeigt.
// Zugriff: ohne CORS – daher über den Daten-Proxy (proxy/cloudflare-worker.js).

const ORIGIN = 'https://archivegenocide.com';
const GEO = `${ORIGIN}/geolocation/`;
const DATA = `${GEO}data/`;
/** Medien-Host (nur für Links/Thumbs – orbis zeigt selbst nichts grafisches an) */
export const MEDIA = 'https://media.archivegenocide.com/';

export const AGEPOCH = '2023-10-07';

export interface AgStats {
  built: string;
  gallery_total: number;
  cats: string[];
  epoch: string;
  gaza_placed_any: number;
  external_points_gaza?: number;
  disputes_gaza?: number;
}

async function json<T>(path: string): Promise<T> {
  const res = await fetch(viaProxy(path));
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Geoload: stats + pins + dots + external once

export interface AgPlace {
  id: number;
  lon: number;
  lat: number;
  /** 0..4: je größer, desto genauer (4 = geolokalisiert) */
  lvl: number;
  cat: string;
  /** 'YYYY-MM-DD' oder '' */
  date: string;
  /** exakt (pin/external) oder approximiert (dot) */
  kind: 'pin' | 'dot' | 'ext';
  /** bei externen: Titel & Quelle statt Clip */
  title?: string;
  srcName?: string;
  srcUrl?: string;
  note?: string;
}

let promise: Promise<{ stats: AgStats; places: AgPlace[] }> | null = null;

export function loadArchive(): Promise<{ stats: AgStats; places: AgPlace[] }> {
  promise ??= (async () => {
    const stats = await json<AgStats>(`${DATA}stats.json`);
    const epoch = new Date(`${stats.epoch || AGEPOCH}T00:00:00Z`).getTime();
    const day = (i: unknown) => (typeof i === 'number' && Number.isFinite(i) ? new Date(epoch + i * 86400000).toISOString().slice(0, 10) : '');
    const cats = stats.cats ?? [];
    const [pins, dots, ext] = await Promise.all([
      json<number[][]>(`${DATA}pins.json`),
      json<number[][]>(`${DATA}dots.json`),
      json<Record<string, unknown>[]>(`${DATA}external.json`),
    ]);
    const places: AgPlace[] = [];
    for (const p of pins) {
      places.push({ id: p[0], lon: p[1], lat: p[2], lvl: p[3], cat: cats[p[4]] ?? 'other', date: day(p[5]) || '', kind: 'pin' });
    }
    for (const d of dots) {
      places.push({ id: d[0], lon: d[1], lat: d[2], lvl: d[3], cat: cats[d[4]] ?? 'other', date: day(d[5]) || '', kind: 'dot' });
    }
    for (const e of ext) {
      const s = (e.source ?? {}) as Record<string, unknown>;
      places.push({
        id: -1,
        lon: Number(e.lon),
        lat: Number(e.lat),
        lvl: String(e.level ?? '').includes('4') ? 4 : 3,
        cat: 'other',
        date: typeof e.date === 'string' ? e.date : '',
        kind: 'ext',
        title: typeof e.title === 'string' ? e.title : '',
        srcName: typeof s.name === 'string' ? s.name : '',
        srcUrl: typeof s.url === 'string' ? s.url : '',
        note: typeof s.attribution === 'string' ? s.attribution : '',
      });
    }
    return { stats, places };
  })();
  promise.catch(() => (promise = null));
  return promise;
}

// ---------------------------------------------------------------------------
// Clip-Buckets (id % 512) – pro Klick fällt genau ein Bucket an, gecacht in der Sitzung

export interface AgClip {
  c: string;
  d: string;
  a: string;
  k: string;
  cat?: string;
  et?: string;
  pu?: string;
  du?: string | null;
  lvl?: string;
}

const buckets = new Map<string, Promise<Record<string, AgClip>>>();

export function bucketOf(id: number): string {
  return String(id % 512).padStart(2, '0');
}

export async function clipOf(id: number): Promise<AgClip | null> {
  const b = bucketOf(id);
  let p = buckets.get(b);
  if (!p) {
    p = json<Record<string, AgClip>>(`${DATA}clips/${b}.json`);
    buckets.set(b, p);
    p.catch(() => buckets.delete(b));
  }
  const rec = (await p)[id] as AgClip | undefined;
  return rec ?? null;
}

// ---------------------------------------------------------------------------
// Quellen der Archive (gescraped einmalig scripts/gazasources.mjs → public/data)

export interface AgSource {
  name: string;
  platform: string;
  count: string;
  note: string;
  url: string;
}
export interface AgWebSource {
  tag: string;
  domain: string;
  desc: string;
  url: string;
}

export interface AgSources {
  built: string;
  source: string;
  sources: AgSource[];
  websites: AgWebSource[];
}

export async function loadSources(): Promise<AgSources> {
  // erzeugt durch scripts/gazasources.mjs (Repository-Daten, mit deployed)
  const res = await fetch('data/gazasources.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Feature-Bau

export function featuresOf(places: AgPlace[], kinds: AgPlace['kind'][]): Feature<Point>[] {
  return places
    .filter((p) => kinds.includes(p.kind) && Number.isFinite(p.lon) && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90)
    .map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        cat: p.cat,
        date: p.date,
        lvl: p.lvl,
        kind: p.kind,
        title: p.title ?? '',
        srcName: p.srcName ?? '',
        srcUrl: p.srcUrl ?? '',
        note: p.note ?? '',
      },
    }));
}

export const clipUrl = (id: number) => `${GEO}#v=${id}`;

/** die Kategorie deutlich benannt (die Liste kommt aus stats.json, Namen wie "urbicide") */
export const CAT_LABEL: Record<string, string> = {
  casualty: 'Opfer',
  demolition: 'Zerstörung',
  detention: 'Gefangenschaft',
  displace: 'Vertreibung',
  execution: 'Hinrichtungen',
  incitement: 'Anstiftung',
  legal: 'Juristisches',
  looting: 'Plünderungen',
  massacre: 'Massaker',
  medical: 'Medizinisches',
  military: 'Militärisches',
  nocaption: 'Ohne Text',
  other: 'Sonstiges',
  press: 'Presse',
  seizure: 'Beschlagnahmung',
  settler: 'Siedler',
  shelter: 'Schutzbauten',
  siege: 'Belagerung',
  starvation: 'Hunger',
  strike: 'Angriffe',
  urbicide: 'Stadtzerstörung',
};

export const catLabel = (c: string) => CAT_LABEL[c] ?? c;
