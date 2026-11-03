import { defineIncident } from '../types';

// Tauchboot „Titan“ (OceanGate), Nordatlantik beim Wrack der Titanic, 18. Juni 2023.
// Zeiten und Tiefen: Bericht der US-Küstenwache (Marine Board of Investigation, Aug. 2025), Wikipedia „Titan submersible implosion“.
// Eine Positionsspur wurde nie veröffentlicht: Die Spur entsteht mit scripts/titan-track.mjs aus den wenigen bekannten Eckwerten
// (siehe dataNotes). Ortszeit des Einsatzes: Neufundland-Sommerzeit NDT = UTC−2:30.

const DEPART = 1686916860; //   16.06. 12:01 UTC (9:31 NDT) Polar Prince verlässt St. John's
const ARRIVE = 1687074300; //   18.06. 07:45 UTC (5:15 NDT) am Tauchplatz
const DIVE = 1687088640; //     18.06. 11:44 UTC (9:14 NDT) Titan löst sich
const LAST_TEXT = 1687094222; // 13:17:02 UTC (10:47:02 NDT) „dropped two wts“
const LAST_PING = 1687094228; // 13:17:08 UTC
const IMPLODE = 1687094229; //  13:17:09 UTC (~10:47:09 NDT)
const HM = (h: number, m: number, d = 18) => Date.UTC(2023, 5, d, h, m) / 1000;

/** Polar Prince beim Tauchgang (Annahme, siehe dataNotes) */
const SHIP = { lat: 41.7365, lon: -49.944 };
/** letzter Ping: 41°44′04″N 49°56′33″W */
const PING = { lat: 41.734444, lon: -49.9425 };
/** Bug der Titanic (ca.), 41°43′57″N 49°56′49″W */
const BOW = { lat: 41.7325, lon: -49.946944 };

export default defineIncident({
  id: 'titan-2023-06-18',
  kind: 'submersible',
  order: 20,
  title: 'Implosion des Tauchboots „Titan“ am Titanic-Wrack',
  shortTitle: 'OceanGate Titan',
  labelSub: '18. Juni 2023',
  subtitle: 'OceanGate Titan · Polar Prince → Titanic · 18. Juni 2023',
  when: '2023-06-18T13:17:09Z',
  lat: PING.lat,
  lon: PING.lon,
  place: 'Nordatlantik, rund 500 m nordöstlich des Titanic-Bugs (Meeresboden ca. 3.800 m)',
  summary:
    'Das Tauchboot Titan des Unternehmens OceanGate tauchte am 18. Juni 2023 vom Begleitschiff Polar Prince zum Wrack der Titanic. Nach gut 90 Minuten, in {{d:3346}} Tiefe, riss der Kontakt ab: Der Druckkörper aus Kohlefaser war implodiert, alle fünf Insassen starben sofort. Nach einer mehrtägigen Suche fand ein Tauchroboter am 22. Juni die Trümmer rund 500 m nordöstlich des Titanic-Bugs. Die US-Küstenwache nannte das Unglück 2025 „vermeidbar“.',
  craft: { callsign: 'Titan', reg: 'OceanGate Titan', type: 'Tauchboot', from: 'Polar Prince (Tauchplatz im Nordatlantik)', to: 'Wrack der Titanic' },
  track: 'data/incidents/titan-2023-06-18/track.json',
  ship: { name: 'Polar Prince', track: 'data/incidents/titan-2023-06-18/ship.json' },
  seabedM: 3800,
  localTime: { label: 'Neufundland (NDT)', offsetH: -2.5 },
  focus: { from: DIVE, to: IMPLODE + 120 },
  dataNotes: [
    'Zeiten nach dem Bericht der US-Küstenwache; Ortszeit des Einsatzes ist Neufundland-Sommerzeit (NDT = UTC−2:30). Wikipedia nennt für das Ablegen 9:18 Uhr, für die letzte Textnachricht 10:47:27 und für den letzten Ping 10:47:33 Uhr NDT; hier gilt die Küstenwache (Ablegen 9:14, Textnachricht 10:47:02, Ping 10:47:08, Implosion rund eine Sekunde später).',
    'Es gibt keine veröffentlichte Positionsspur des Tauchboots. Bekannt sind nur drei Tiefen ({{d:2274}} bei „all good here“, {{d:3341}} bei der letzten Textnachricht, {{d:3346}} beim letzten Ping; Implosion in 3.346,28 m) und die Position des letzten Pings (41°44′04″N 49°56′33″W). Alles dazwischen ist berechnet (mit * markiert): gleichmäßiges Sinken (rund {{d:36}} pro Minute) auf gerader Linie vom Tauchplatz zur Ping-Position.',
    'Die Position der Polar Prince beim Tauchgang ist nicht veröffentlicht; angenommen ist ein Punkt rund 260 m von der Ping-Position. Ihre Fahrt von St. John’s (16. Juni, 12:01 UTC) zum Tauchplatz (18. Juni, 07:45 UTC) ist eine Gerade mit gleichbleibender Geschwindigkeit (rund 8,4 Knoten) zwischen den bekannten Zeiten, nicht die echte Route (keine AIS-Daten).',
    'Die Zeit der Nachricht „all good here“ ist nicht überliefert; sie ist aus der Tiefe von {{d:2274}} auf der berechneten Sinkkurve abgeleitet. Die Uhrzeit der Navy-Ortung (11:04 Uhr NDT) stammt aus Wikipedia und weicht von den Zeiten der Küstenwache ab; Berichte nennen die Ortung zeitgleich mit dem Kontaktabbruch.',
    'Der Wasserdruck im Panel ist eine Näherung für Meerwasser (rund 0,1 bar je Meter). Die Küstenwache nennt etwa 4.930 psi in der Implosionstiefe.',
    'Das Tauchboot unter Wasser wird durch die Karte hindurch gezeigt; das 3D-Modell ist schematisch (Länge etwa 6,7 m), nicht die echte Form. Die Ausrichtung folgt der Bewegungsrichtung. Der Titanic-Bug ist als ungefähre Position eingetragen.',
  ],
  events: [
    { t: DEPART, kind: 'info', label: 'Polar Prince verlässt St. John’s', text: 'Beginn der „Mission 5“ der Titanic-Expedition (rund 40 Personen an Bord). 9:31 Uhr NDT.', at: { lat: 47.5615, lon: -52.7126 } },
    { t: ARRIVE, kind: 'info', label: 'Ankunft am Tauchplatz', text: 'Die Polar Prince erreicht die Stelle über dem Wrack, 5:15 Uhr NDT.', at: SHIP },
    { t: HM(11, 0), kind: 'info', label: 'Besatzung steigt ein', text: 'Fünf Personen gehen an Bord der Titan: Stockton Rush (OceanGate, Pilot), Paul-Henri Nargeolet, Hamish Harding, Shahzada Dawood und Suleman Dawood. Das ist „Tauchgang 88“.', at: SHIP },
    { t: DIVE, kind: 'info', label: 'Tauchgang beginnt', text: 'Titan löst sich vom Startgerüst und sinkt Richtung Titanic (rund 9:14 Uhr NDT). Ziel: Wrack in {{d:3800}}.', at: BOW },
    { t: HM(12, 47) + 19, kind: 'radio', label: 'Textnachricht: „all good here“', text: 'Die Titan meldet der Polar Prince in rund {{d:2274}} Tiefe, dass alles in Ordnung ist. Texte kamen etwa alle 15 Minuten, dazu automatische Pings alle 5 bis 10 Sekunden. Uhrzeit aus der Tiefe berechnet.' },
    { t: LAST_TEXT, kind: 'radio', label: 'Letzte Nachricht: „dropped two wts“', text: 'Die Titan meldet in {{d:3341}} Tiefe, dass sie zwei Gewichte abgeworfen hat (10:47:02 Uhr NDT). Die Besatzung der Polar Prince hört danach einen Knall.' },
    { t: LAST_PING, kind: 'radio', label: 'Letzter automatischer Ping', text: 'Letzte Positionsmeldung in {{d:3346}}: 41°44′04″N 49°56′33″W, rund 430 m nordöstlich des Titanic-Bugs.' },
    {
      t: IMPLODE,
      kind: 'impact',
      label: 'Implosion',
      text: 'In 3.346,28 m Tiefe versagt der Druckkörper bei rund 4.930 psi (etwa 340 bar). Alle fünf Insassen sterben sofort (US-Küstenwache).',
      src: { label: 'US-Küstenwache', url: 'https://www.news.uscg.mil/Press-Releases/Article/4265651/coast-guard-marine-board-of-investigation-releases-report-on-titan-submersible/' },
    },
    { t: IMPLODE + 2, kind: 'info', label: 'Knall an Bord der Polar Prince', text: 'Rund zwei Sekunden nach der Implosion hört die Kommunikationsabteilung auf dem Schiff einen Knall (Bericht der Küstenwache).', at: SHIP },
    { t: HM(13, 34), kind: 'info', label: 'Navy-Ortung: „Anomalie“', text: 'Ein Unterwasser-Hörsystem der US-Marine registriert ein Signal, das zu einer Implosion passt. Es passt zu keinem bekannten U-Boot-Profil und gilt zunächst als „Anomalie“ (Zeit laut Wikipedia, siehe Hinweise).', at: PING  },
    { t: HM(19, 0), kind: 'info', label: 'Rückkehr überfällig', text: 'Um 16:30 Uhr NDT hätte die Titan auftauchen sollen.', at: SHIP  },
    { t: HM(21, 40), kind: 'info', label: 'Alarm: Titan vermisst', text: 'Die US-Küstenwache wird informiert (19:10 Uhr NDT laut Wikipedia). Es beginnt eine Suche mit Flugzeugen und Schiffen auf rund 26.000 km².', at: SHIP  },
    { t: HM(15, 0, 20), kind: 'info', label: 'Suche: Tauchroboter treffen ein', text: 'Das Spezialschiff Deep Energy erreicht mit zwei Tauchrobotern (ROV) das Suchgebiet; am 21. Juni folgen weitere Schiffe.', at: SHIP  },
    { t: HM(15, 48, 22), kind: 'info', label: 'Trümmerfeld entdeckt', text: 'Der ROV „Odysseus 6K“ findet nach rund fünf Stunden das Trümmerfeld: Heckkonus und beide Endkappen liegen rund 500 m nordöstlich des Titanic-Bugs.', at: PING  },
    { t: HM(19, 0, 22), kind: 'info', label: 'Küstenwache: Implosion', text: 'Bei einer Pressekonferenz erklärt die US-Küstenwache, die Titan sei implodiert.', at: PING },
  ],
  media: [
    {
      group: 'Original-Material der Küstenwache',
      title: 'Mutmaßlicher Schall der Implosion (23 s)',
      platform: 'DVIDS / US-Küstenwache',
      note: 'Audio, NOAA-Hydrofon rund 900 Meilen entfernt',
      url: 'https://www.dvidshub.net/video/951839/titan-submersible-coast-guard-marine-board-investigation-releases-audio-recording',
      t: IMPLODE,
      at: PING,
    },
    {
      group: 'Original-Material der Küstenwache',
      title: 'ROV-Aufnahmen des Wracks und der Bergung',
      platform: 'DVIDS / US-Küstenwache',
      url: 'https://www.dvidshub.net/video/937609/coast-guard-marine-board-investigation-releases-remotely-operated-vehicle-footage-titan-submersible-incident-salvage',
      at: PING,
    },
    { group: 'Nachrichten', title: 'Erste Aufnahmen des Wracks (Anhörung der Küstenwache)', platform: 'Fox Weather', url: 'https://www.foxweather.com/weather-news/video-oceangate-titantc-submersible-implosion-debris-field' },
    { group: 'Nachrichten', title: 'Küstenwache veröffentlicht Unterwasser-Video des Wracks', platform: 'Fox News', url: 'https://www.foxnews.com/us/coast-guard-releases-video-showing-titan-submersible-wreck-bottom-atlantic' },
    { group: 'Nachrichten', title: 'Die Anhörung der Küstenwache: Höhepunkte', platform: 'Good Morning America', url: 'https://goodmorningamerica.com/news/story/titan-implosion-coast-guard-hearing-highlights-114296878' },
    { group: 'Nachrichten', title: 'Abschlussbericht: Das Unglück war vermeidbar', platform: 'gCaptain', url: 'https://gcaptain.com/coast-guard-investigation-reveals-oceangate-titan-tragedy-was-entirely-preventable/' },
  ],
  sources: [
    { label: 'Wikipedia: Titan submersible implosion', url: 'https://en.wikipedia.org/wiki/Titan_submersible_implosion' },
    { label: 'US-Küstenwache: Bericht des Marine Board of Investigation', url: 'https://www.news.uscg.mil/Press-Releases/Article/4265651/coast-guard-marine-board-of-investigation-releases-report-on-titan-submersible/' },
    { label: 'DVIDS: Audio der mutmaßlichen Implosion (gemeinfrei)', url: 'https://www.dvidshub.net/video/951839/titan-submersible-coast-guard-marine-board-investigation-releases-audio-recording' },
    { label: 'gCaptain: Abschlussbericht', url: 'https://gcaptain.com/coast-guard-investigation-reveals-oceangate-titan-tragedy-was-entirely-preventable/' },
  ],
});
