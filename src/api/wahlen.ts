// Wahlergebnisse der Ebene „Wahlen": Snapshots in public/data/wahlen (de.json + de-geo.json,
// gebaut von scripts/wahlen-data.mjs). Historische Wahlen ändern sich nie wieder – die Dateien
// werden einmal pro Browser geladen (ETag-Cache) und danach gecacht.
// Zeitstrahl = ein Schritt pro Wahltermin; jedes Gebiet zeigt immer das Ergebnis seiner
// letzten Wahl vor dem gewählten Termin.
import type { FeatureCollection } from 'geojson';
import { fetchJsonEtag } from '../util';

export type WahlenKind = 'all' | 'btw' | 'ltw';

/** Partei-Buckets (Reihenfolge = Legende) */
export const PARTIES: { id: string; label: string; color: string }[] = [
  { id: 'CDU', label: 'CDU', color: '#2b2b30' },
  { id: 'CSU', label: 'CSU', color: '#004b76' },
  { id: 'SPD', label: 'SPD', color: '#c0003d' },
  { id: 'GRUENE', label: 'Bündnis 90/Die Grünen', color: '#008549' },
  { id: 'FDP', label: 'FDP', color: '#f7bc3d' },
  { id: 'LINKE', label: 'Die Linke', color: '#5f316e' },
  { id: 'AFD', label: 'AfD', color: '#80cdec' },
  { id: 'BSW', label: 'BSW', color: '#a2419f' },
  { id: 'SSW', label: 'SSW', color: '#d8b64a' },
  { id: 'FW', label: 'Freie Wähler', color: '#8db849' },
  { id: 'SONST', label: 'Sonstige', color: '#bec5c9' },
];
const PARTY = new Map(PARTIES.map((p) => [p.id, p]));
export const partyColor = (id: string) => PARTY.get(id)?.color ?? '#bec5c9';
export const partyLabel = (id: string) => PARTY.get(id)?.label ?? id;

export interface WahlenResult {
  /** Parteien mit Stimmen (absolute Zahlen) */
  p: [string, number][];
  /** Wahlbeteiligung in Prozent */
  b: number | null;
}

export interface WahlenDoc {
  schema: number;
  built: string;
  source: string;
  regions: Record<string, string>;
  /** Bundestagswahlen: Datum → Ergebnis je Region */
  btw: { d: string; g: Record<string, WahlenResult> }[];
  /** Landtagswahlen: je Wahl genau ein Gebiet */
  ltw: { d: string; r: string; p: [string, number][]; b: number | null }[];
}

export interface WahlenMark {
  d: string;
  kind: 'btw' | 'ltw';
  label: string;
  /** Datum als ms */
  t: number;
  /** Index in der zugehörigen doc-Liste (doc.btw bzw. doc.ltw) */
  idx: number;
}

let doc: WahlenDoc | null = null;
let geo: FeatureCollection | null = null;
let loadPromise: Promise<boolean> | null = null;
let marks: WahlenMark[] = [];
export const wahlenReady = () => !!doc && !!geo;

// ---- Auswahl (Art der Wahlen + Schritt im Zeitstrahl) ----------------------------------------
let kind: WahlenKind = 'all';
/** -1 = noch nicht bewegt (neueste Wahl) */
let step = -1;

const subs = new Set<() => void>();
const notify = () => {
  for (const fn of [...subs]) fn();
};
export const subscribeWahlen = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
export const wahlenKind = (): WahlenKind => kind;

/** Filter-Token der Ebene → Art; true, wenn sich die Art geändert hat */
export function setWahlenKindToken(token: string): boolean {
  const k: WahlenKind = token === 'btw' || token === 'ltw' ? token : 'all';
  if (!doc || k === kind) return false;
  kind = k;
  step = -1;
  rebuild();
  notify();
  return true;
}
export const wahlenStep = (): number => (step >= 0 && step < marks.length ? step : marks.length - 1);
export function setWahlenStep(i: number) {
  const next = Math.max(0, Math.min(marks.length - 1, i));
  if (next === wahlenStep()) return;
  step = next;
  notify();
}

const parseDay = (d: string) => Date.parse(`${d.slice(0, 10)}T12:00:00Z`);

/** alle Wahltermine (nach Art gefiltert) aufsteigend */
function rebuild() {
  const next: WahlenMark[] = [];
  if (doc) {
    const regions = doc.regions;
    for (let i = 0; i < doc.btw.length; i++) {
      const d = doc.btw[i].d;
      next.push({ d, kind: 'btw', label: `Bundestagswahl ${d.slice(0, 4)}`, t: parseDay(d), idx: i });
    }
    for (let i = 0; i < doc.ltw.length; i++) {
      const e = doc.ltw[i];
      next.push({ d: e.d, kind: 'ltw', label: `Landtagswahl ${regions[e.r] ?? e.r} ${e.d.slice(0, 4)}`, t: parseDay(e.d), idx: i });
    }
  }
  next.sort((a, b) => (a.d === b.d ? a.label.localeCompare(b.label) : a.d < b.d ? -1 : 1));
  marks = next.filter((m) => kindAllowed(m, kind));
}
const kindAllowed = (m: WahlenMark, k: WahlenKind) => k === 'all' || m.kind === k;

export const wahlenMarks = (): WahlenMark[] => marks;
export const wahlenMark = (): WahlenMark | null => marks[wahlenStep()] ?? null;

const dayLabel = (d: string) => new Date(parseDay(d)).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
export const wahlenAnchorLabel = (): string => {
  const m = marks[wahlenStep()];
  return m ? `${m.label} · ${dayLabel(m.d)}` : '';
};

/** Ergebnis eines Gebiets: beste Wahl vor (oder am) Anker */
export function wahlenResultAt(region: string): WahlenResult | null {
  if (!doc) return null;
  for (let i = wahlenStep(); i >= 0; i--) {
    const m = marks[i];
    if (m.kind === 'btw') {
      const r = doc.btw[m.idx]?.g[region];
      if (r) return r;
    } else {
      const e = doc.ltw[m.idx];
      if (e && e.r === region) return { p: e.p, b: e.b };
    }
  }
  return null;
}

/** Partei mit den meisten gültigen Stimmen */
export function winnerOf(res: WahlenResult): [string, number] | null {
  let best: [string, number] | null = null;
  for (const q of res.p) if (q[0] !== 'SONST' && (!best || q[1] > best[1])) best = q;
  return best;
}

/** Legende: Parteien, die am Anker-Termin mindestens ein Gebiet gewinnen */
export function wahlenLegendInfo(): { title: string; sub: string; swatches: [string, string][] } | null {
  if (!marks.length) return null;
  const winners = new Set<string>();
  for (const region of Object.keys(doc!.regions)) {
    const res = wahlenResultAt(region);
    const w = res && winnerOf(res);
    if (w) winners.add(w[0]);
  }
  if (!winners.size) return null;
  const swatches: [string, string][] = PARTIES.filter((p) => winners.has(p.id)).map((p) => [p.color, p.label] as [string, string]);
  return { title: 'Wahlergebnisse', sub: `Sieger je Gebiet · ${wahlenAnchorLabel()}`, swatches };
}

// ---- Laden (einmal pro Browser, danach Cache) ------------------------------------------------
export async function loadWahlen(): Promise<{ doc: WahlenDoc; geo: FeatureCollection } | null> {
  if (!loadPromise)
    loadPromise = (async () => {
      const [w, g] = await Promise.all([
        fetchJsonEtag<WahlenDoc>('/data/wahlen/de.json', 'wahlen'),
        fetchJsonEtag<FeatureCollection>('/data/wahlen/de-geo.json', 'wahlen'),
      ]);
      if (!w || !g) throw new Error('Wahldaten unvollständig');
      doc = w;
      geo = g;
      rebuild();
      notify();
      return true;
    })().catch((e) => {
      loadPromise = null;
      throw e;
    });
  if (!wahlenReady()) await loadPromise;
  return doc && geo ? { doc, geo } : null;
}
