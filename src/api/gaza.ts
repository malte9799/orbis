// Gaza und Westjordanland: Zahlen aus offenen Datensätzen.
// - Tech for Palestine (data.techforpalestine.org, Public Domain): Tageszahlen des Gesundheits-
//   ministeriums Gaza und der UN-Meldungen im Westjordanland, Infrastruktur-Schäden, Namensliste
//   (Zusammenfassung). Die API hat CORS `*` und wird direkt gelesen.
// - IPC Hunger (HDX, CC0): scripts/fetch-data.ts spiegelt `ipc-gaza.json` in den data-Branch.

const T4P = 'https://data.techforpalestine.org/api/';

async function t4p<T>(path: string): Promise<T> {
  const res = await fetch(`${T4P}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
  return res.json() as Promise<T>;
}

export interface GazaDay {
  report_date: string;
  ext_killed_cum?: number;
  killed_cum?: number;
  ext_injured_cum?: number;
  injured_cum?: number;
  ext_killed_children_cum?: number;
  ext_killed_women_cum?: number;
  ext_massacres_cum?: number;
  ext_civdef_killed_cum?: number;
  ext_med_killed_cum?: number;
  ext_press_killed_cum?: number;
}

export interface WestBankDay {
  report_date: string;
  killed_cum?: number;
  killed_children_cum?: number;
  injured_cum?: number;
  injured_children_cum?: number;
  settler_attacks_cum?: number;
  displaced_persons_cum?: number;
  displaced_children_cum?: number;
}

export interface InfraDay {
  report_date: string;
  civic_buildings?: { ext_destroyed?: number };
  educational_buildings?: { ext_destroyed?: number; ext_damaged?: number };
  places_of_worship?: { ext_mosques_destroyed?: number; ext_churches_destroyed?: number };
  residential?: { ext_destroyed?: number };
}

export interface KnownKilled {
  records: number;
  male: { adult: number; senior: number; child: number };
  female: { adult: number; senior: number; child: number };
  last_update: string;
  includes_until: string;
}

export interface GazaFigures {
  gaza: GazaDay[];
  westBank: WestBankDay[];
  infra: InfraDay[];
  known: KnownKilled | null;
}

let memo: Promise<GazaFigures> | null = null;

export function gazaFigures(): Promise<GazaFigures> {
  memo ??= (async () => {
    const [gaza, westBank, infra, summary] = await Promise.all([
      t4p<GazaDay[]>('v2/casualties_daily.json'),
      t4p<WestBankDay[]>('v2/west_bank_daily.json'),
      t4p<InfraDay[]>('v3/infrastructure-damaged.json').catch(() => [] as InfraDay[]),
      t4p<{ known_killed_in_gaza?: KnownKilled }>('v3/summary.json').catch(() => ({}) as { known_killed_in_gaza?: KnownKilled }),
    ]);
    return { gaza, westBank, infra, known: summary.known_killed_in_gaza ?? null };
  })();
  memo.catch(() => (memo = null));
  return memo;
}

// ---------------------------------------------------------------------------
// IPC Hunger

export interface IpcPeriod {
  from: string;
  to: string;
  kind: string;
  analysis: string;
  /** Anteile je Phase ('1'…'5', '3+', 'all') */
  p: Record<string, number>;
  n: Record<string, number>;
}

export interface IpcArea {
  name: string;
  geometry: GeoJSON.Geometry;
  phase: number;
  period: string;
  pop: number;
  shares: number[];
  people: number[];
  history: IpcPeriod[];
}

export interface IpcData {
  built: string;
  source: string;
  areas: IpcArea[];
}

let memoIpc: Promise<IpcData> | null = null;

export function ipcGaza(): Promise<IpcData> {
  memoIpc ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<IpcData>('ipc-gaza.json');
  })();
  memoIpc.catch(() => (memoIpc = null));
  return memoIpc;
}

// ---------------------------------------------------------------------------
// Vertreibung (IDMC) und Gesundheitseinrichtungen (Healthsites/OSM), beide als Snapshot aus HDX

export interface DisplacementEvent {
  d: string;
  lat: number;
  lon: number;
  /** betroffene Personen */
  f: number;
  /** Ortsangabe */
  l: string;
  /** Ereignisart */
  t: string;
  /** Vertreibungsursache */
  k: string;
  /** Ereignisname */
  e: string;
  /** meldende Stelle */
  s: string;
  /** Beschreibung */
  x: string;
}

export interface DisplacementData {
  built: string;
  source: string;
  events: DisplacementEvent[];
}

let memoDisp: Promise<DisplacementData> | null = null;

export function gazaDisplacement(): Promise<DisplacementData> {
  memoDisp ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<DisplacementData>('gaza-displacement.json');
  })();
  memoDisp.catch(() => (memoDisp = null));
  return memoDisp;
}

export interface HealthPlace {
  lon: number;
  lat: number;
  /** hospital | clinic | doctors | pharmacy | dentist */
  a: string;
  n: string;
  o: string;
  /** Link zum OSM-Objekt */
  u: string;
}

export interface HealthData {
  built: string;
  source: string;
  places: HealthPlace[];
}

let memoHealth: Promise<HealthData> | null = null;

export function palestineHealthsites(): Promise<HealthData> {
  memoHealth ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<HealthData>('healthsites-pse.json');
  })();
  memoHealth.catch(() => (memoHealth = null));
  return memoHealth;
}
