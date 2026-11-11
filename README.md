# 📦 Branch `data` – Daten-Snapshots für Orbis

Statische Dateien von Quellen, die ein Browser nicht direkt abfragen darf oder kann (keine
CORS-Header, gesperrte Origins). Sie werden hier abgelegt und über
`raw.githubusercontent.com/malte9799/orbis/data/…` ausgeliefert – GitHub setzt dort CORS-Header
und beim Browser-Caching an.

- **Erzeugung:** [`.github/workflows/data.yml`](https://github.com/malte9799/orbis/blob/main/.github/workflows/data.yml)
  mit [`scripts/fetch-data.ts`](https://github.com/malte9799/orbis/blob/main/scripts/fetch-data.ts)
- **Aktualisierung:** Cron `7,22,37,52 * * * *` → der Workflow läuft **alle 15 Minuten**; innerhalb
  eines Laufs gilt für jeden Task ein eigenes Intervall (siehe Tabelle). Jeder Lauf pusht einen
  neuen **Orphan-Commit mit `git push -f`** – die Commit-Historie dieses Branchs ist also ohne
  Aussagekraft, wichtig sind nur die Dateien.
- **Fehlerfall:** Schlägt ein Download fehl, bleibt die Datei vom vorherigen Lauf stehen
  (`fetch-data.ts` kopiert zu Beginn den alten Branch-Stand in das Ausgabeverzeichnis).
  `meta.json` protokolliert, wann welcher Task zuletzt erfolgreich war.

Dieser README bleibt von den Läufen erhalten, weil der vorherige Branch-Stand immer als
Vorlage kopiert wird – er also nur ergänzt, nie neu aufgebaut wird.

## Inhalt

| Datei/Verzeichnis | Inhalt | Quelle | Intervall | Abfrage im Code |
|---|---|---|---|---|
| `bfs-odl.json` | Gamma-Ortsdosis, Messstellen Deutschland | BfS ODL | 15 min | `src/api/earth.ts` |
| `eurdep.json` | Gamma-Ortsdosis, Messstellen Europa | EURDEP | 15 min | `src/api/earth.ts` |
| `safecast.json` | Safecast-Messgeräte (Strahlung) | Safecast | 15 min | `src/api/earth.ts` |
| `tsunami/PAAQ.xml`, `tsunami/PHEB.xml` | Tsunami-Warnungen (Atom-Feeds) | NOAA NWS tsunami.gov | 15 min | `src/api/earth.ts` |
| `firms/world.json` | Brände/Fires weltweit, Sensoren VIIRS/MODIS NRT | FIRMS (Schlüssel nötig, sonst übersprungen) | 15 min | `src/api/events.ts` (Kartenebene) |
| `mars/traverse.json` | Traversen von Perseverance, Curiosity und Ingenuity | NASA-Dienste (Skript `mars-traverse.mjs`) | 6 h | `src/space/mars.ts` |
| `volcanoes.json` | Holozän-Vulkane (FeatureCollection) | Smithsonian GVP | 23 h | `src/api/earth.ts` |
| `radio/top.json` | die 4 000 meistgeklickten Radiostationen mit Position | radio-browser.info | 23 h | `src/api/radio.ts` |
| `radio/cells/<10°-Zelle>.json` | alle Stationen je 10°-Zelle | radio-browser.info | 23 h | `src/api/radio.ts` (nach Umkreis) |
| `cams/<feed>.json` | Kamerakatalog eines Verkehrs-/Webcam-Feeds | Webseiten der 511-/Verkehrsbehörden etc., Liste unter `src/api/camfeeds.ts` | 23 h | `src/globe/layers/defs/webcams.ts` |
| `cams/world.json` | alle Kamerapositionen für die Webcam-Heatmap | zusammengeführt aus `cams/*.json` + Digitraffic | 23 h | `src/globe/layers/defs/webcams.ts` |
| `osm-cables/cables.json` + `LICENSE.txt` | Seekabel als LineStrings, je Kabel eine Farbe | OpenStreetMap (Overpass) | 23 h | `src/api/infra.ts` |
| `osm-datacenters/datacenters.json` + `LICENSE.txt` | Rechenzentren als Punkte (Name, Betreiber) | OpenStreetMap (Overpass) | 7 × 23 h | `src/api/infra.ts` (mit PeeringDB gemerged) |
| `street/panos.json` | Mapillary-360°-Panoramen fürs Straßenraten-Spiel | Mapillary (Token) | ~29 d | `src/games/streetguess.ts` |
| `meta.json` | Zeitstempel der letzten Läufe je Task | generiert | 15 min | `snapshotsAvailable()` in `src/api/data.ts` |

`cams` umfasst **32 Feeds**, `radio` ergibt **229 Dateien**; die übrigen Tasks schreiben je
eine bis drei Dateien. Für OpenStreetMap-Daten liegt die ODbL-Pflichtangabe als `LICENSE.txt`
neben der Datendatei; die übrigen Angaben zu Lizenz/Nutzung stehen in `docs/DATENQUELLEN.md`.

## Abfrageverhalten der App

Alle Lader laufen über [`src/api/data.ts`](https://github.com/malte9799/orbis/blob/main/src/api/data.ts):

- `snapshotJson(path, live?)` / `snapshotText(path, live?)` – holt die Datei mit Timeout
  (30 s bzw. 20 s); bei Fehler wird stattdessen der **Live-Fallback** an der originalen Quelle
  ausgeführt. Der Branch ist also optional: ohne ihn funktioniert die App langsamer bzw. für
  manche Ebenen gar nicht (die Quellen sind gerade wegen CORS gesperrt).
- `snapshotsAvailable()` – testet einmal pro Session `meta.json` (Timeout 10 s) und merkt sich
  das Ergebnis; Module nutzen das, um Live-Fallbacks zu überspringen.
- Abgefragt wird **bei Bedarf** – beim Aktivieren der betreffenden Karte/Ebene bzw. beim ersten
  Aufruf der Funktion – und pro Modul im Speicher gecacht. Es gibt **keine periodische
  Wiederholung im Browser: die Frische der Daten bestimmt der 15-min-Workflow auf GitHub.**
