import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { StyleSpecification } from 'maplibre-gl';

// Data and geometry helpers shared by the games (country features, scopes, name matching, region lists).

export type Props = { id: string; name: string; en: string; cont?: string; sub?: string; pop?: number; sov?: number; flag?: string; cap?: string[]; capEn?: string[] };
export type Feat = Feature<Geometry, Props>;

export interface Scope {
  id: string;
  label: string;
  filter?: (p: Props) => boolean;
  /** fixed map view [w, s, e, n] – the bounding box of e.g. Russia or France (Guyana) is useless */
  view?: BBox;
}

export const DATA = `${import.meta.env.BASE_URL}data/games/`;
export type BBox = [number, number, number, number];
export const SCOPES: Scope[] = [
  { id: 'world', label: 'Welt', view: [-168, -56, 180, 80] },
  { id: 'Europe', view: [-25, 34, 45, 72], label: 'Europa', filter: (p) => p.cont === 'Europe' },
  { id: 'Asia', view: [25, -11, 150, 55], label: 'Asien', filter: (p) => p.cont === 'Asia' },
  { id: 'Africa', view: [-20, -36, 53, 38], label: 'Afrika', filter: (p) => p.cont === 'Africa' },
  { id: 'North America', view: [-170, 7, -50, 72], label: 'Nordamerika', filter: (p) => p.cont === 'North America' },
  { id: 'South America', view: [-83, -56, -34, 13], label: 'Südamerika', filter: (p) => p.cont === 'South America' },
  { id: 'Oceania', view: [110, -48, 180, 0], label: 'Ozeanien', filter: (p) => p.cont === 'Oceania' },
];
/** a SCOPES id, or `conts:Europe,Asia` for several continents at once */
export function scopeOf(id: string): Scope | undefined {
  if (!id.startsWith('conts:')) return SCOPES.find((s) => s.id === id);
  const keys = id.slice(6).split(',');
  const parts = SCOPES.filter((s) => keys.includes(s.id));
  const views = parts.map((s) => s.view!);
  return {
    id,
    label: parts.map((s) => s.label).join(', '),
    filter: (p) => keys.includes(p.cont ?? ''),
    view: [Math.min(...views.map((v) => v[0])), Math.min(...views.map((v) => v[1])), Math.max(...views.map((v) => v[2])), Math.max(...views.map((v) => v[3]))],
  };
}
export const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1530' } }],
};

/** lower case, no diacritics, ß→ss, only letters/digits */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function eachPos(g: Geometry, fn: (p: Position) => void) {
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') fn(c as Position);
    else (c as unknown[]).forEach(walk);
  };
  if (g.type !== 'GeometryCollection') walk(g.coordinates);
}

export function bboxOf(fs: Feat[]): BBox {
  const b: BBox = [180, 90, -180, -90];
  for (const f of fs)
    eachPos(f.geometry, (p) => {
      b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
    });
  return b;
}

/** bounding box of the feature's biggest part */
export function mainBox(f: Feat): BBox {
  const g = f.geometry;
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let best: BBox = [0, 0, 0, 0];
  let area = -1;
  for (const p of parts) {
    const xs = p[0].map((q) => q[0]);
    const ys = p[0].map((q) => q[1]);
    const b: BBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const a = (b[2] - b[0]) * (b[3] - b[1]);
    if (a > area) { area = a; best = b; }
  }
  return best;
}

/** a point inside/near the feature: centre of its biggest part's bounding box */
export function anchor(f: Feat): [number, number] {
  const b = mainBox(f);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

/** bbox around the biggest part of every feature – unlike the real bbox it ignores far-flung parts (Aleutians crossing the antimeridian) */
export function anchorView(fs: Feat[]): BBox {
  const boxes = fs.map(mainBox);
  const pad = 1.5;
  return [Math.min(...boxes.map((b) => b[0])) - pad, Math.min(...boxes.map((b) => b[1])) - pad, Math.max(...boxes.map((b) => b[2])) + pad, Math.max(...boxes.map((b) => b[3])) + pad];
}

/** span (degrees) of the biggest single part – an archipelago like Hawaii is as hard to spot as its biggest island */
export function span(f: Feat): number {
  const g = f.geometry;
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let best = 0;
  for (const p of parts) {
    const xs = p[0].map((q) => q[0]);
    const ys = p[0].map((q) => q[1]);
    best = Math.max(best, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  return best;
}

export const cache = new Map<string, Promise<FeatureCollection<Geometry, Props>>>();
export function loadData(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = fetch(DATA + file).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

export const HIST_KEY = 'orbis-gm-region-history';
/** countries picked in the "Regional" grid, most recent first */
export function regionHistory(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function saveRegionHistory(id: string) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify([id, ...regionHistory().filter((x) => x !== id)].slice(0, 8)));
  } catch {
    /* private mode */
  }
}
/** km² per ISO code, to sort the countries by size */
export let areasP: Promise<Map<string, number>> | null = null;
export function countryAreas(): Promise<Map<string, number>> {
  areasP ??= (async () => {
    const { areaKm2 } = await import('../games/sizeduel');
    const m = new Map<string, number>();
    for (const f of (await loadData('countries.json')).features as Feat[]) {
      const iso = (f.properties as Props & { iso?: string }).iso;
      if (iso) m.set(iso, (m.get(iso) ?? 0) + areaKm2(f.geometry));
    }
    return m;
  })();
  areasP.catch(() => (areasP = null));
  return areasP;
}

export const regionIndexP: { p: Promise<{ id: string; name: string; n: number }[]> | null } = { p: null };
export function loadRegionIndex() {
  regionIndexP.p ??= fetch(`${DATA}admin1/index.json`).then((r) => {
    if (!r.ok) throw new Error('Regionsliste konnte nicht geladen werden');
    return r.json();
  });
  regionIndexP.p.catch(() => (regionIndexP.p = null));
  return regionIndexP.p;
}
