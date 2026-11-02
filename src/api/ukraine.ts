// Zivile Schäden in der Ukraine (Bellingcat „Civilian Harm in Ukraine“): scripts/fetch-data.ts
// spiegelt die öffentlichen Rohdaten der TimeMap täglich als `ukraine-harm.json` in den
// `data`-Branch; der Browser liest nur den Snapshot. Die Vorfälle verlinken auf Originalposts
// (Social Media) – Medien werden nicht kopiert oder eingebettet.

export interface UkraineHarm {
  id: string;
  /** 'YYYY-MM-DD' */
  d: string;
  /** Ortsname */
  l: string;
  lat: number;
  lon: number;
  /** Beschreibung */
  t: string;
  /** Auswirkung (z. B. Residential, Medical) */
  i?: string[];
  /** Waffensystem */
  w?: string[];
  /** Beleg-Links (Originalposts) */
  s: string[];
  /** 1 = Bellingcat markiert den Inhalt als drastisch */
  g?: 1;
}

export interface UkraineHarmData {
  built: string;
  source: string;
  events: UkraineHarm[];
}

export const UKRAINE_HARM_SITE = 'https://ukraine.bellingcat.com/';

let memo: Promise<UkraineHarmData> | null = null;

export function ukraineHarm(): Promise<UkraineHarmData> {
  memo ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<UkraineHarmData>('ukraine-harm.json');
  })();
  memo.catch(() => (memo = null));
  return memo;
}

// ---------------------------------------------------------------------------
// Hilfe für die Ukraine (Kiel Ukraine Support Tracker): scripts/fetch-data.ts liest wöchentlich die
// XLSX-Veröffentlichung des Instituts und legt je Geberland die zugewiesenen Beträge (Mrd. €) als
// `ukraine-support.json` in den `data`-Branch.

export interface UkraineDonor {
  n: string;
  lat: number;
  lon: number;
  /** zugewiesene Hilfe in Mrd. €: finanziell, humanitär, militärisch, gesamt */
  fin: number;
  hum: number;
  mil: number;
  tot: number;
}

export interface UkraineSupportData {
  built: string;
  source: string;
  /** Link zur XLSX-Veröffentlichung dieses Stands */
  xlsx: string;
  /** Stichtag der Daten (Text, z. B. "August 31, 2026") */
  asOf: string;
  countries: UkraineDonor[];
}

export const UKRAINE_SUPPORT_SITE = 'https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/';

let memoSupport: Promise<UkraineSupportData> | null = null;

export function ukraineSupport(): Promise<UkraineSupportData> {
  memoSupport ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<UkraineSupportData>('ukraine-support.json');
  })();
  memoSupport.catch(() => (memoSupport = null));
  return memoSupport;
}

// ---------------------------------------------------------------------------
// Lage nach Oblast: Insecurity Insight (Vorfälle mit Explosivwaffen, nur Region – die Koordinaten sind
// im Datensatz gelöscht), offizielle Luftalarme (Stunden je Monat) und WHO SSA (Angriffe aufs
// Gesundheitswesen je Monat, ohne Ort). scripts/fetch-data.ts schreibt `ukraine-oblast.json`.

export interface UkraineRegion {
  /** Vorfälle gesamt, je Jahr / Sektor / Waffenart */
  ew: number;
  year: Record<string, number>;
  sector: Record<string, number>;
  weapon: Record<string, number>;
  /** Getötete: aid, health, educators, students */
  killed: Record<string, number>;
  /** Datum des letzten Vorfalls */
  last: string;
  /** Luftalarm-Stunden je Monat ('YYYY-MM') */
  air: Record<string, number>;
}

export interface UkraineOblastData {
  built: string;
  source: string;
  /** Vorfälle ohne zuordenbare Region */
  unresolved: number;
  regions: Record<string, UkraineRegion>;
  who: Record<string, { attacks: number; killed: number; injured: number }>;
}

let memoOblast: Promise<UkraineOblastData> | null = null;

export function ukraineOblast(): Promise<UkraineOblastData> {
  memoOblast ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<UkraineOblastData>('ukraine-oblast.json');
  })();
  memoOblast.catch(() => (memoOblast = null));
  return memoOblast;
}

/** Schlüssel der Regionen im Snapshot: Gebietsname klein, ohne Sonderzeichen; Stadt Kiew gesondert */
export const oblastKey = (en: string, type = ''): string => (type === 'Municipality' ? 'kyivcity' : en.toLowerCase().replace(/[^a-z]/g, ''));
