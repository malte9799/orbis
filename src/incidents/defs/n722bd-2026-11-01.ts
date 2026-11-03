import { defineIncident } from '../types';

// Learjet 60 N722BD, Palm Beach County (Florida), 1. November 2026.
// Flugspur: ADS-B-Export von Flightradar24 (scripts/incident-track.mjs). Alles Weitere sind Berichte der unten
// genannten Quellen; eine amtliche Ursache gibt es noch nicht (FAA/NTSB ermitteln).

/**
 * Beginn des Funk-Clips (Unix-s): von Hand auf die Spur abgestimmt (Ton gegen Höhe und Sprechpausen), nicht aus einer Quelle.
 * Verschieben: nur diese Zahl ändern, die Funk-Marker und Untertitel folgen.
 */
const AUDIO_START = 1793555263.5;
/** Ende der Spur = Einschlag (berechnet, siehe dataNotes): Wert in scripts/incident-track.mjs --impactAt */
const IMPACT = 1793555376;
/** Sekunde im Clip → Unix-Zeit */
const at = (clipSec: number) => AUDIO_START + clipSec;

export default defineIncident({
  id: 'n722bd-2026-11-01',
  order: 10,
  title: 'Learjet-Absturz bei Greenacres, Florida',
  subtitle: 'N722BD · Austin → North Eleuthera · 1. Nov. 2026',
  when: '2026-11-01T17:50:00Z',
  lat: 26.632889,
  lon: -80.113111,
  place: 'Greenacres, Palm Beach County (Military Trail / 10th Ave N)',
  summary:
    'Ein Learjet 60 stürzte auf dem Flug von Austin (Texas) nach North Eleuthera (Bahamas) in Palm Beach County ab. Alle neun Personen an Bord kamen ums Leben. FAA und NTSB ermitteln, eine Ursache ist nicht bekannt.',
  aircraft: { callsign: 'N722BD', reg: 'N722BD', hex: 'A9AB17', type: 'Learjet 60', from: 'Austin–Bergstrom (KAUS)', to: 'North Eleuthera (MYEH)' },
  track: 'data/incidents/n722bd-2026-11-01/track.json',
  focus: { from: 1793555100, to: 1793555380 },
  dataNotes: [
    'Flugspur: ADS-B-Daten von Flightradar24. Höhe in Fuß (barometrisch), Geschwindigkeit als Groundspeed in Knoten, alle Zeiten UTC (Florida: UTC−5, Austin: UTC−6).',
    'Zwischen 17:48:07 und 17:48:39 UTC gibt es keine Meldung; der Beginn des Sturzes liegt in dieser Lücke, die Spur ist dort nur linear verbunden.',
    'Letzter Höhenwert der Quelle: {{ft:8750}} um 17:49:23 UTC. Danach liefert sie nur noch Positionen bis 17:49:31 UTC (rund {{m:180}} vom Einschlagsort). Der letzte Punkt der Spur ist der angegebene Einschlagsort. Zeit, Höhe und Position dazwischen sind berechnet (mit * markiert, keine Messung): Die Höhe sinkt mit gleichbleibender Rate (etwa {{fpm:40400}}, die zuletzt gemessene Rate war {{fpm:41250}}) bis genau auf 0 am Einschlagsort; die Geschwindigkeit über Grund nimmt dabei ab, sodass die Bahn stetig steiler wird. Daraus ergibt sich der Einschlag um 17:49:36 UTC. Die Berichte nennen nur „gegen 12:50 Uhr Ortszeit“ (17:50 UTC), auf die Minute gerundet; eine sekundengenaue Einschlagszeit liegt nicht vor.',
    'Sinkraten im Panel sind aus dem Abstand zweier Punkte berechnet (2 s) und daher gröber als die von Flightradar24 genannten Spitzenwerte (mehr als {{fpm:32000}}).',
    'Funk-Clip: Die Lage zur Spur ist von Hand abgestimmt (Ton gegen Höhe), nicht aus einer Quelle mit Uhrzeit; sie kann um ein paar Sekunden abweichen.',
    'Untertitel zum Clip, nicht amtlich geprüft; Hörfehler sind möglich.',
    'Die Flugzeugneigung im 3D-Modell ist nicht gemessen: Sie folgt dem Winkel der gezeigten Bahn (Höhenänderung gegen zurückgelegten Weg) und steigt im berechneten Endstück stetig auf etwa 80° Nase unten am Einschlagsort (Berichte: „nahezu senkrecht“).',
  ],
  events: [
    { t: 1793547419, kind: 'flight', label: 'Startlauf', text: 'Beschleunigung auf der Bahn in Austin.' },
    { t: 1793547430, kind: 'flight', label: 'Abheben', text: 'Erste Höhenmeldung: {{ft:275}}.' },
    { t: 1793548863, kind: 'flight', label: 'Reiseflughöhe {{ft:41000}}' },
    {
      t: 1793554634,
      kind: 'flight',
      label: 'Sinkflug auf {{ft:35000}}',
      text: 'Von {{ft:41000}} auf rund {{ft:35000}} zwischen 17:37 und 17:41 UTC.',
    },
    {
      t: 1793555287,
      kind: 'flight',
      label: 'Letzter regulärer Flugzustand',
      text: '{{ft:35250}}, {{kn:437}}, leichtes Steigen – kurz darauf beginnt der Sturz (Quelle: Flightradar24, Air Data News).',
      src: { label: 'Air Data News', url: 'https://www.airdatanews.com/learjet-60-crashes-into-urban-area-in-florida-after-rapid-dive/' },
    },
    { t: 1793555326, kind: 'flight', label: 'Sturzflug', text: '{{ft:28950}}, {{kn:505}}, rechte Spirale.' },
    { t: at(41.6), kind: 'radio', label: 'Funk: Niederschlag, Bitte um FL370', text: 'Besatzung meldet Niederschlag und bittet um Steigflug auf Flugfläche 370 (Clip 0:41).' },
    { t: at(54.6), kind: 'radio', label: 'Funk: Mayday', text: 'Besatzung meldet Sinkflug und ruft „Mayday“ (Clip 0:54).' },
    { t: at(66.3), kind: 'radio', label: 'Funk: Notlage, Überschreitung der Höchstgeschwindigkeit', text: 'Besatzung nennt eine Sinkrate von {{fpm:20000}} (Clip 1:06).' },
    { t: at(85), kind: 'radio', label: 'Funk: letzte Meldung der Besatzung an die Flugsicherung', text: '„{{ft:22000}} Sinkflug, 60° Querlage“ (Clip 1:25). Danach rufen die Lotsen die Maschine noch mehrfach.' },
    { t: 1793555363, kind: 'flight', label: 'Letzter Höhenwert', text: '{{ft:8750}}.' },
    { t: 1793555371, kind: 'flight', label: 'Letzte Position', text: 'Letzte gemessene Position, rund {{m:180}} vom Einschlagsort.' },
    {
      t: IMPACT,
      kind: 'impact',
      label: 'Einschlag',
      at: { lat: 26.632889, lon: -80.113111 },
      src: { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/2026_Palm_Beach_County_Learjet_60_crash' },
    },
  ],
  // Videos nur einbetten/verlinken. Position und Zeit je Video selbst festlegen: `t` (Unix-s, UTC) setzt die Marke auf der
  // Zeitleiste, `at: { lat, lon }` die Marke auf der Karte (ohne `at` auf der Flugspur zur Zeit `t`).
  media: [
    { group: 'Einschlag', title: 'Reel', platform: 'Instagram', note: 'lang, fern', url: 'https://www.instagram.com/reels/DfNekoeguTB/' },
    { group: 'Einschlag', title: 'Video 2', platform: 'Reddit', note: 'mittel', url: 'https://www.reddit.com/r/aircrashinvestigation/comments/1xlg0o9/learjet_60_n722bd_crashes_near_greenacres_video_2/' },
    { group: 'Einschlag', title: 'Dashcam', platform: 'Reddit', note: 'Explosion nah', url: 'https://www.reddit.com/r/aviation/comments/1xlcp7p/dashcam_footage_of_01nov26_crash_in_west_palm/' },
    { group: 'Danach', title: 'Krater', platform: 'Facebook', note: 'CBS News', url: 'https://www.facebook.com/CBSNews/videos/a-massive-crater-was-seen-on-the-ground-following-a-deadly-plane-crash-in-palm-b/4579722982346152/' },
    { group: 'Danach', title: 'Reel', platform: 'Facebook', url: 'https://www.facebook.com/reel/1643065457610833' },
    { group: 'Danach', title: 'Reel', platform: 'Instagram', url: 'https://www.instagram.com/reels/DfNbf3JAtUo/' },
    { group: 'Danach', title: 'Hubschrauber', platform: 'Instagram', note: 'Heli', url: 'https://www.instagram.com/reels/DfNbL1uhajg/' },
  ],
  audio: {
    src: 'data/incidents/n722bd-2026-11-01/funk.m4a',
    title: 'Funkverkehr (Tonspur des Clips)',
    startUnix: AUDIO_START,
    credit: { label: 'AirNav Radar auf X', url: 'https://x.com/AirNavRadar/status/2117026892192579691' },
  cues: [
    { s: 0.72, e: 6.7, text: "722 Bravo Delta, 350, moderate turbulence, plus or minus— okay," },
    { s: 6.72, e: 10.44, text: "now 700 feet, 600 feet." },
    { s: 10.56, e: 13.92, text: "November 722 Bravo Delta, roger, say outside air temperature." },
    { s: 14.4, e: 16.45, text: "-47 degrees Celsius." },
    { s: 16.48, e: 18.8, text: "We're managing the ice, but it is moderate turbulence." },
    { s: 19.0, e: 22.5, text: "We're direct report. Okay, November 722 Bravo Delta, roger." },
    { s: 22.52, e: 23.89, text: "Let me know if you need anything else." },
    { s: 23.92, e: 26.02, text: "I'm just working you into my airspace right now." },
    { s: 26.04, e: 26.44, text: "Thank you." },
    { s: 26.46, e: 29.88, text: "If you have any better rides, let us know, 2 Bravo Delta." },
    { s: 30.0, e: 33.76, text: "November 2 Bravo Delta, the rides do improve in my airspace." },
    { s: 34.52, e: 36.56, text: "You're kind of far outside of it right now, and you can expect" },
    { s: 36.59, e: 37.48, text: "better rides ahead." },
    { s: 38.0, e: 39.58, text: "Roger, 2 Bravo Delta." },
    { s: 39.6, e: 41.26, text: "And now we're picking up precipitation." },
    { s: 41.64, e: 45.28, text: "We need to climb 370, Gable, 2 Bravo Delta." },
    { s: 45.8, e: 47.9, text: "November 722 Bravo Delta, roger." },
    { s: 47.92, e: 49.73, text: "Climb and maintain flight level 370." },
    { s: 49.76, e: 52.1, text: "No further rights in your present heading for traffic." },
    { s: 52.12, e: 54.04, text: "Climb 370, 2 Bravo Delta." },
    { s: 54.56, e: 58.17, text: "722 Bravo Delta, we're descending 8,000— mayday, mayday, we're descending" },
    { s: 58.2, e: 59.6, text: "10,000 feet per minute." },
    { s: 60.68, e: 63.64, text: "November 722 Bravo Delta, roger." },
    { s: 63.72, e: 66.16, text: "Declaring emergency, 722 Bravo Delta." },
    { s: 66.32, e: 69.92, text: "We are in an overspeed condition, descending 20,000 feet per minute." },
    { s: 70.48, e: 72.45, text: "November 722 Bravo Delta, roger." },
    { s: 72.48, e: 74.56, text: "Altitude your discretion, let me know what you need." },
    { s: 77.2, e: 80.0, text: "We're gonna crash into the ground, 722 Bravo Delta." },
    { s: 81.8, e: 84.36, text: "November 2 Bravo Delta, I'm here with you. Talk to me." },
    { s: 85.0, e: 89.96, text: "We are descending 22,000 feet and we are banking 60 degrees." },
    { s: 95.68, e: 97.36, text: "November 2 Bravo Delta, roger." },
    { s: 100.76, e: 102.32, text: "Mark, look outside! Jack, look outside!" },
    { s: 102.4, e: 105.2, text: "Holy shit, we're out of 10,000 feet!" },
    { s: 106.88, e: 107.92, text: "November 2 Bravo Delta." },
    { s: 109.28, e: 112.68, text: "November 2 Bravo Delta, how do you hear?" },
    { s: 112.8, e: 115.08, text: "November 2 Bravo Delta, Miami." },
  ],
  },
  sources: [
    { label: 'Wikipedia: 2026 Palm Beach County Learjet 60 crash', url: 'https://en.wikipedia.org/wiki/2026_Palm_Beach_County_Learjet_60_crash' },
    { label: 'Flightradar24 auf X', url: 'https://x.com/flightradar24/status/2116985522480656708' },
    { label: 'Air Data News', url: 'https://www.airdatanews.com/learjet-60-crashes-into-urban-area-in-florida-after-rapid-dive/' },
    { label: 'Al Jazeera', url: 'https://www.aljazeera.com/news/2026/11/2/nine-die-in-cataclysmic-florida-business-jet' },
    { label: 'NBC News', url: 'https://www.nbcnews.com/news/us-news/jet-crashes-florida-nine-people-board-rcna606874' },
  ],
});
