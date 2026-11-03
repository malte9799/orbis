// Ereignis-Rekonstruktion: ein Ereignis ist eine Datei in ./defs (Dateiname = id). index.ts sammelt sie,
// so ändert ein neues Ereignis keine gemeinsame Liste. Flugspur und Tonspur liegen als statische Dateien
// unter public/data/incidents/<id>/.

export interface IncidentLink {
  label: string;
  url: string;
}

/** Marker auf der Zeitleiste und der Karte (Unix-Sekunden, UTC) */
export interface IncidentEvent {
  t: number;
  kind: 'flight' | 'radio' | 'weather' | 'impact' | 'info';
  label: string;
  text?: string;
  /** Ort des Markers; fehlt er, nimmt die Karte die Position der Flugspur zu dieser Zeit */
  at?: { lat: number; lon: number };
  src?: IncidentLink;
}

/** Fremdmaterial (Videos, Beiträge): nur eingebettet bzw. verlinkt, nichts davon liegt im Projekt */
export interface IncidentMedia {
  title: string;
  /** woher: "X", "Instagram" … */
  platform: string;
  url: string;
  /** Videodatei im Projekt (Pfad unter public/): wird direkt im Panel abgespielt; hat Vorrang vor der Einbettung des Hosters */
  file?: string;
  /** Überschrift in der Liste ("Einschlag", "Danach" …) */
  group?: string;
  /** kurzer Zusatz (z. B. "lang, fern") */
  note?: string;
  credit?: string;
  /** Zeit (Unix-s, UTC) und Ort der Aufnahme: setzt Marke auf Zeitleiste und Karte; beides optional */
  t?: number;
  at?: { lat: number; lon: number };
}

export interface IncidentAudio {
  /** Pfad unter public/ (mit BASE_URL aufzulösen) */
  src: string;
  title: string;
  credit: IncidentLink;
  /** Unix-Sekunden (UTC), zu denen der Clip beginnt – ohne Angabe läuft er unabhängig von der Spur */
  startUnix?: number;
  /** Untertitel/Transkript, Zeiten in Sekunden im Clip */
  cues?: { s: number; e: number; text: string }[];
}

export interface IncidentDef {
  id: string;
  /** Reihenfolge in Listen; Lücken lassen */
  order: number;
  title: string;
  subtitle: string;
  /** Beginn der Rekonstruktion in der Liste: Datum/Zeit des Ereignisses (ISO, UTC) */
  when: string;
  /** Unglücksort */
  lat: number;
  lon: number;
  place: string;
  /** sachliche Kurzfassung mit Quellen */
  summary: string;
  aircraft: { callsign: string; reg: string; hex: string; type: string; from: string; to: string };
  /** Pfad der Flugspur unter public/ */
  track: string;
  /** Teilfenster für den Regler "Endphase" (Unix-Sekunden) */
  focus: { from: number; to: number };
  /** wie die Daten zu lesen sind (Einheiten, Lücken, Unsicherheiten) */
  dataNotes: string[];
  events: IncidentEvent[];
  media: IncidentMedia[];
  audio?: IncidentAudio;
  sources: IncidentLink[];
}

export const defineIncident = (def: IncidentDef): IncidentDef => def;

/** [Unix-s, lat, lon, Höhe ft | null (unbekannt), Groundspeed kt, Kurs °, 1 = Höhe/Position berechnet statt gemessen] */
export type TrackPoint = [number, number, number, number | null, number, number, 1?];

export interface Sample {
  t: number;
  lat: number;
  lon: number;
  /** ft; null: keine Höhe in der Quelle */
  alt: number | null;
  /** die Höhe ist der letzte bekannte Wert (kein neuer Messwert) */
  altHeld: boolean;
  gs: number;
  trk: number;
  /** Steig-/Sinkrate in ft/min aus den Nachbarpunkten, null ohne Höhen */
  vs: number | null;
  /** Index des Punktes davor */
  i: number;
}
