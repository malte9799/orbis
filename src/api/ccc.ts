// Snapshot der US-Protest-Events (Crowd Counting Consortium, Harvard/UConn, CC0 1.0): Die
// Dataverse-CSV (Phase 3, monatlich fortgeschrieben) wird von scripts/fetch-data.ts wöchentlich
// heruntergeladen, auf Ereignispunkte reduziert und als `ccc-us.json` in den `data`-Branch gelegt.
//
// `s` ist die geschätzte Größe (size_mean); `sb` der Freitext zur Größe; `so` die erste beigelegte Quelle.

export interface CccEvent {
  /** Datum (YYYY-MM-DD) */
  d: string;
  /** Titel */
  t: string;
  /** Typ ("demonstration", "rally; march" …) */
  ty?: string;
  city?: string;
  /** Bundesstaat (Abkürzung) */
  st?: string;
  lon: number;
  lat: number;
  /** geschätzte Teilnehmer (size_mean) */
  s?: number;
  /** Freitext zur Größe */
  sb?: string;
  /** Themen/Issues (gekürzt) */
  is?: string;
  /** Anzahl Festnahmen */
  ar?: number;
  /** erste beigelegte Quelle */
  so?: string;
  /** zweite Quelle (Belegketten) */
  so2?: string;
  /** untere Schätzungsgrenze (size_low) */
  slo?: number;
  /** obere Schätzungsgrenze (size_high) */
  shi?: number;
  /** Anliegen der Demonstrationen/liner (claims_summary) */
  cl?: string;
  /** Polizei-Maßnahmen vor Ort */
  pl?: string;
  /** Sachschaden */
  dmg?: string;
  /** verletzte Teilnehmer / Polizei (Freitext) */
  pi?: string;
  poi?: string;
  /** Todesopfer Teilnehmer / Polizei (Freitext) */
  pd?: string;
  pod?: string;
}

export interface CccData {
  built: string;
  source: string;
  lic: string;
  events: CccEvent[];
}

export const CCC_DATAVERSE = 'https://doi.org/10.7910/DVN/RI9JFU';

let memo: Promise<CccData> | null = null;

export function ccc(): Promise<CccData> {
  memo ??= (async () => {
    const { snapshotJson } = await import('./data');
    return snapshotJson<CccData>('ccc-us.json');
  })();
  memo.catch(() => (memo = null));
  return memo;
}
