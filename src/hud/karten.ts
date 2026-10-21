import { store } from '../store';
import { BASES, type BaseId } from '../globe/style';
import { catalogOf } from './catalog';
import { hasIcon } from './icons';

// A "Karte" is a saved map preset: name, look, base map, at most one weather main layer and an
// ordered list of overlay layers. Orbis ships three standard Karten; users can change any of them
// (the change lives in a per-Karte draft) and save the result as their own Karte.

export interface KLayer {
  /** id of an extra layer or an event group (see catalog.ts) */
  id: string;
  hidden?: boolean;
  /** 0..100, default 100 */
  opacity?: number;
  /** layer specific filter (quake magnitude, aircraft kinds …) */
  filter?: string;
}

export interface KView {
  center: [number, number];
  zoom: number;
  /** place name for the label (looked up when the view is saved) */
  name?: string;
}

export interface Karte {
  id: string;
  name: string;
  icon: string;
  color: string;
  std?: boolean;
  base: BaseId;
  labels: boolean;
  night: boolean;
  /** weather family id (catalog.ts) or null */
  main: string | null;
  /** overlay id of the chosen variant */
  mainVar?: string;
  wind?: boolean;
  isobars?: boolean;
  layers: KLayer[];
  view?: KView;
  savedAt?: number;
}

export const MAX_PINNED = 5;

export const STANDARD: Karte[] = [
  {
    id: 'wetter', name: 'Wetter', icon: 'cloud', color: '#4f8dff', std: true,
    base: 'satellite', labels: true, night: true, main: 'radar', mainVar: 'radar',
    layers: [{ id: 'cities' }, { id: 'dwdwarn' }],
  },
  {
    id: 'gefahren', name: 'Gefahren', icon: 'warn', color: '#e53935', std: true,
    base: 'dark', labels: true, night: true, main: null,
    layers: ['dwdwarn', 'nina', 'quakes', 'fires', 'storms', 'volcanoes', 'floods', 'tsunami'].map((id) => ({ id })),
  },
  {
    id: 'verkehr', name: 'Verkehr', icon: 'plane2', color: '#ffb547', std: true,
    base: 'dark', labels: true, night: true, main: null,
    layers: ['aircraft', 'ships', 'trains', 'autobahn'].map((id) => ({ id })),
  },
];

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function blankKarte(): Karte {
  return {
    id: newId(), name: 'Neue Karte', icon: 'pin', color: '#a58bff',
    base: 'satellite', labels: true, night: true, main: null, layers: [], savedAt: Date.now(),
  };
}

export const newId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Everything that makes two Karten "different" for the changed-marker (the view only by presence). */
export function signature(k: Karte): string {
  return JSON.stringify([
    k.name, k.icon, k.color, k.base, k.labels, k.night, k.main, k.mainVar ?? '', !!k.wind, !!k.isobars,
    k.layers.map((l) => [l.id, !!l.hidden, l.opacity ?? 100, l.filter ?? '']), !!k.view,
  ]);
}

// ---------------------------------------------------------------------------
// Persistence

interface Persisted {
  v: 1;
  own: Karte[];
  pinned: string[];
  last: string;
  drafts: Record<string, Karte>;
}

export interface KartenState {
  own: Karte[];
  pinned: string[];
  last: string;
  drafts: Record<string, Karte>;
}

/**
 * A Karte from storage (or a shared link) with every field checked: unknown layers are dropped,
 * bad values fall back to defaults. Returns null when nothing usable is left.
 */
export function sanitizeKarte(raw: unknown, id?: string): Karte | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Record<keyof Karte, unknown>>;
  const kid = id ?? (typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : null);
  if (!kid || !Array.isArray(r.layers)) return null;
  const seen = new Set<string>();
  const layers: KLayer[] = [];
  for (const l of r.layers as unknown[]) {
    const o = l as Partial<Record<keyof KLayer, unknown>> | null;
    if (!o || typeof o.id !== 'string' || seen.has(o.id) || !catalogOf(o.id)) continue;
    seen.add(o.id);
    const k: KLayer = { id: o.id };
    if (o.hidden === true) k.hidden = true;
    if (typeof o.opacity === 'number' && Number.isFinite(o.opacity) && o.opacity < 100) k.opacity = Math.max(10, Math.round(o.opacity));
    if (typeof o.filter === 'string' && o.filter) k.filter = o.filter.slice(0, 60);
    layers.push(k);
    if (layers.length >= 60) break;
  }
  const k: Karte = {
    id: kid,
    name: (typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Karte').slice(0, 40),
    icon: typeof r.icon === 'string' && hasIcon(r.icon) ? r.icon : 'pin',
    color: typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#a58bff',
    base: BASES.some((b) => b.id === r.base) ? (r.base as BaseId) : 'satellite',
    labels: r.labels !== false,
    night: r.night !== false,
    main: typeof r.main === 'string' && r.main ? r.main : null,
    layers,
  };
  if (r.std === true) k.std = true;
  if (k.main && typeof r.mainVar === 'string') k.mainVar = r.mainVar;
  if (r.wind === false) k.wind = false;
  if (r.isobars === true) k.isobars = true;
  const v = r.view as Partial<KView> | undefined;
  if (v && Array.isArray(v.center) && Number.isFinite(v.center[0]) && Number.isFinite(v.center[1]) && Number.isFinite(v.zoom)) {
    k.view = { center: [Number(v.center[0]), Number(v.center[1])], zoom: Number(v.zoom) };
    if (typeof v.name === 'string') k.view.name = v.name.slice(0, 80);
  }
  if (typeof r.savedAt === 'number' && Number.isFinite(r.savedAt)) k.savedAt = r.savedAt;
  return k;
}

export function loadKarten(): KartenState {
  const p0 = store.getHud<unknown>({});
  const p = (p0 && typeof p0 === 'object' ? p0 : {}) as Partial<Record<keyof Persisted, unknown>>;
  const stdIds = new Set(STANDARD.map((k) => k.id));
  const own: Karte[] = [];
  for (const raw of Array.isArray(p.own) ? p.own : []) {
    const k = sanitizeKarte(raw);
    if (!k || stdIds.has(k.id) || own.some((o) => o.id === k.id)) continue;
    delete k.std;
    own.push(k);
  }
  const known = new Set([...stdIds, ...own.map((k) => k.id)]);
  const pinned = [...new Set((Array.isArray(p.pinned) ? p.pinned : []).filter((id): id is string => typeof id === 'string' && known.has(id)))].slice(0, MAX_PINNED);
  const drafts: Record<string, Karte> = {};
  if (p.drafts && typeof p.drafts === 'object') {
    for (const [id, raw] of Object.entries(p.drafts as Record<string, unknown>)) {
      if (!known.has(id)) continue;
      const d = sanitizeKarte(raw, id);
      if (!d) continue;
      if (stdIds.has(id)) d.std = true;
      else delete d.std;
      drafts[id] = d;
    }
  }
  const last = typeof p.last === 'string' && known.has(p.last) ? p.last : 'wetter';
  return { own, pinned: pinned.length ? pinned : STANDARD.map((k) => k.id), last, drafts };
}

export function saveKarten(s: KartenState) {
  const p: Persisted = { v: 1, own: s.own, pinned: s.pinned, last: s.last, drafts: s.drafts };
  store.setHud(p);
}
