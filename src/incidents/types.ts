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
  /** Vorschaubild (Pfad unter public/) für das Tooltip an der Marke; ohne: erstes Bild der Videodatei, sonst nur Titel */
  thumb?: string;
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

/** Art des Fahrzeugs: Flugzeug (Höhe in ft über Grund) oder Tauchboot (Spur in Metern, unter Wasser negativ) */
export type IncidentKind = 'aircraft' | 'submersible';

export interface IncidentDef {
  id: string;
  /** ohne Angabe: 'aircraft'. 'submersible': Höhe der Spur ist die Wassertiefe in m (negativ, 0 = Meeresspiegel) */
  kind?: IncidentKind;
  /** Reihenfolge in Listen; Lücken lassen */
  order: number;
  title: string;
  /** kurzer Name für das Label auf der Karte ("Learjet-Absturz") */
  shortTitle?: string;
  subtitle: string;
  /** Beginn der Rekonstruktion in der Liste: Datum/Zeit des Ereignisses (ISO, UTC) */
  when: string;
  /** Unglücksort */
  lat: number;
  lon: number;
  place: string;
  /** sachliche Kurzfassung mit Quellen */
  summary: string;
  craft: { callsign: string; reg: string; hex?: string; type: string; from: string; to: string };
  /** Pfad der Flugspur (Tauchspur) unter public/ */
  track: string;
  /** Begleitschiff (z. B. Mutterschiff): eigene Spur im gleichen Format (Höhe 0), wird als Schiff gezeigt */
  ship?: { name: string; track: string };
  /** Meeresboden am Ort (m, positiv): Maßstab für Profil und "über Grund" bei Tauchbooten */
  seabedM?: number;
  /** Ortszeit neben UTC in der Leiste, z. B. { label: 'Florida', offsetH: -5 } */
  localTime?: { label: string; offsetH: number };
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

/** [Unix-s, lat, lon, Höhe ft (Tauchboot: Tiefe m, negativ) | null (unbekannt), Groundspeed kt, Kurs °, 1 = Höhe/Position berechnet statt gemessen] */
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
