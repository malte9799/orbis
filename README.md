# 📦 Branch `data-osm` – OpenStreetMap-Punktdaten als Kacheln

Punktdaten aus monatlichen OpenStreetMap-Regionalauszügen (Geofabrik), zu 0,5°-Kacheln
gebündelt, damit die App keine Live-Overpass-Abfragen mehr braucht. Nur **Nodes** sind
enthalten – Ways/Flächen mit denselben Tags nicht (die Aufrufer fragen Overpass dann
weiter live, oder vollständig, solange der Snapshot fehlt).

- **Erzeugung:** [`scripts/cctv-heat.mjs`](https://github.com/malte9799/orbis/blob/main/scripts/cctv-heat.mjs)
  läuft in [`.github/workflows/cctv-heat.yml`](https://github.com/malte9799/orbis/blob/main/.github/workflows/cctv-heat.yml)
  (ursprünglich für die CCTV-Dichte gebaut, im selben Durchlauf werden die weiteren
  Punktdatensätze mitgesammelt): der Regionalextract wird durch osmium gestreamt
  (`osmium tags-filter -R`), nichts Großes wird gespeichert.
- **Aktualisierung:** Cron `17 3 * * *` → **täglich**, aber pro Lauf wird nur **eine Region**
  neu gebaut – und zwar die älteste, deren Daten älter als 30 Tage sind. Damit staffeln sich
  die 8 Regionen über den Monatsrhythmus; jede Region ist also **bis zu 30 Tage alt**.
  Region kann über `workflow_dispatch` (`region=`) erzwungen werden.
- Jeder Lauf pusht einen **Orphan-Commit mit `git push -f`** – die Commit-Historie dieses
  Branchs ist ohne Aussagekraft, zählen nur die Dateien.
- `meta.json` listet je Region den Bauzeitpunkt plus Kamera-/Zellen-/Kachel- und
  Punktzahlen je Datensatz; `FORMAT` im Skript zählt bei Layoutänderung hoch und macht
  alte Regionen damit „stale“.
- Hintergrund: dieser Branch ist vom `data`-Branch getrennt, weil seine langen Läufe
  (bis ~3 h) die 15-minütigen Live-Snapshots nicht aufhalten dürfen.

## Regionen

europe, russia, asia, north-america, central-america, south-america, africa, oceania
(Geofabrik-Auszüge; `oceania` = `australia-oceania`). Aktuelle Zahlen je Region stehen in
`meta.json`.

## Dateilayout

| Muster | Inhalt |
|---|---|
| `cctv-<region>.json` | Kamera-Dichte als Zellen `[lon, lat, count]`, 0,01° ≈ 1 km – Grundlage der CCTV-Heatmap, bis Zoom ~6 |
| `cctv-<region>-tiles.json` | Liste der 0,5°-Kacheln, die es für CCTV in der Region gibt |
| `cctv-<region>/<x>_<y>.json` | die Einzelkameras dieser 0,5°-Kachel (ab Zoom ~6) |
| `<set>-<region>-tiles.json` | dasselbe Kachelsystem für die weiteren Datensätze – Liste der Kacheln |
| `<set>-<region>/<x>_<y>.json` | die Punkte dieser 0,5°-Kachel |
| `LICENSE.txt` | ODbL-Pflichtangabe (OpenStreetMap-Mitwirkende, Auszüge Geofabrik) |

`<set>` ∈ `blitzer` (highway=speed_camera, mit enforcement-Relations verfeinert), `alpr`
(surveillance:type=ALPR), `webcam` (OSM-Webcams mit Link), `wind` (einzelne Windräder,
generator:source=wind), `resource` (Bergwerke, Stollen, Bohrungen/Öl/Gas, Steinbrüche,
Raffinerien).

## Record-Formate (Arrays, Details siehe `record`-Funktionen im Skript)

- `cctv`: `[lon, lat, dir°|-1, surveillance, camera:type, camera:mount, guard 0|1, operator, node id]`
- `blitzer`: `[lon, lat, dir°|-1, kind 'cam'|'section'|'signals', maxspeed, operator, ref, node id]`
- `alpr`: `[lon, lat, dir°|-1, brand, flock 0|1, mount, operator, zone, since, ref, node id]`
- `webcam`: `[lon, lat, dir°|-1, name, operator, panning 0|1, link, node id]`
- `wind`: `[lon, lat, name, operator, manufacturer, model, output, node id]`
- `resource`: `[lon, lat, name, kind-Label, Ressourcen-Begriffe, resource-Tag, operator, node id]`

## Abfrage im Code

Zentrale Lader: [`src/api/osmtiles.ts`](https://github.com/malte9799/orbis/blob/main/src/api/osmtiles.ts)
und das CCTV-Layer unter [`src/globe/layers/defs/cctv.ts`](https://github.com/malte9799/orbis/blob/main/src/globe/layers/defs/cctv.ts):

- Ausgeliefert über `raw.githubusercontent.com/malte9799/orbis/data-osm/…`; die Basis wird in
  `src/api/osmtiles.ts` aus `DATA_BASE` (`src/api/data.ts`) abgeleitet.
- Der Datensatz-**Index** (`<set>-<region>-tiles.json`, 8 Regionen) wird pro Session einmal
  geholt und gecacht; schlagen alle 8 fehl, wird beim nächsten Versuch wiederholt.
- **Kacheln** (`<x>_<y>.json`) werden je nach gewünschtem Ausschnitt bei Bedarf geladen –
  pro Kachel einmal, dann Speicher-Cache; fehlgeschlagene Kacheln werden erneut versucht.
- `snapshotOrNull(set, bounds)` liefert die Daten oder `null`, wenn der Snapshot
  nicht erreichbar/ungenau ist → der Aufrufer fällt **live auf Overpass zurück** (die
  CCTV-Heatmap ist ein Sonderfall: es gibt dort keinen Live-Fallback, sie zeigt nur den
  Übersichtsstand).

Verbraucher der Datensätze:

| Datensatz | Verbraucher |
|---|---|
| `cctv` (Heatmap + Kacheln) | `src/globe/layers/defs/cctv.ts` (Ebene „Überwachungskameras“) |
| `webcam` | `src/api/cams.ts` (Webcams von OSM) |
| `alpr` | `src/api/cams.ts` (Kennzeichenleser; zusätzlich die ALPR-Ebene mit Sichtrichtungen) |
| `blitzer` | `src/api/cams.ts` (Blitzer) |
| `wind` | `src/api/infra.ts` (Windkraft-Ebene) |
| `resource` | `src/api/resources.ts` (Ressourcen-Ebene) |

Regeln zur Frische: **die Inhalte im Branch sind bis zu 30 Tage alt** (eine Region pro Tag neu).
Im Browser werden geladene Indexe und Kacheln bis zum Session-Ende gecacht.

## Lizenz

OpenStreetMap-Daten © OpenStreetMap-Mitwirkende, ODbL 1.0; Auszüge von Geofabrik.
Siehe `LICENSE.txt`.
