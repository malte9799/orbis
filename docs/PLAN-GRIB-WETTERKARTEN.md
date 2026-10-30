# Plan: Wetterkarten aus Modell-Rohdaten (DWD ICON, GRIB2) statt Open-Meteo-Punktraster

Stand: 2026-10-30 · Status: **Schritt 1 umgesetzt (nur Temperatur, lokal getestet)**; ICON-EU zurückgestellt, Hosting R2, Horizont 72 h

Umsetzungsnotizen Schritt 1: Format siehe [WETTERDATEN-FORMAT.md](WETTERDATEN-FORMAT.md). Abweichungen vom Plan: Läufe liegen unter `v1/<lauf>/…` (unveränderlich, lange cachebar) statt überschriebener Pfade; `latest.json` ist der einzige kurz gecachte Eintrag. Gemessen: Temperatur 39,8 MB für 33 Dateien; Prädiktor „Plane + Zeitdifferenz“ spart gegenüber reiner Zeilen-Differenz ~15–40 %. Punktprobe gegen Open-Meteo `icon_global`: München ±0,5 K; Lhasa/La Paz weichen um 1–3,5 K ab, weil Open-Meteo auf die echte Höhe herunterskaliert (→ Höhenkorrektur, Schritt 5).

## 1. Ausgangslage und Ziel

**Ist** (`src/api/model.ts`): Globales Raster 15°×10° (24×17 = 408 Punkte = 408 Open-Meteo-Aufrufe, `getGlobalModel`), 10 Variablen
(`MODEL_VARS`), 3-stündlich, Open-Meteo wählt das Modell (`best_match`). Detailraster bis 0,25° nur für den Ausschnitt (`detailRequest`, max. 100 Punkte),
Region für `fcmap` 17×9 Punkte bei 1° (153 Aufrufe). `ModelSampler` mischt global/detail (B-Spline, Feder-Gewicht) und zwischen Zeitschritten;
`overlay.ts` rendert per `wxfield://`-Protokoll Kacheln aus dem Sampler (plus organische Körnung wegen des groben Rasters).
Free-Tier (`omlimit.ts`: 590/min, 10 000/Tag) verhindert alles Feinere. Abgeleitet im Browser: `u`,`v`, Taupunkt, gefühlte Temperatur.

**Soll:** ICON global mit ~13 km (0,125°) aus Rohdaten, serverseitig (GitHub-Action) in ein kompaktes Feldformat im Branch `data-wx` gewandelt,
vom Client über dieselbe `ModelGrid`/`ModelSampler`-Schnittstelle gelesen. Windpartikel, Isobaren, Legende, Zeitleiste, Readouts und `fcmap` bleiben unverändert.
Open-Meteo bleibt für Ortsansicht, Marine, Flood, Luftqualität – und als Fallback für die Karten.

## 2. Entscheidungen (Kurzfassung)

| Frage | Entscheidung |
|---|---|
| Primärquelle | **DWD ICON global** (`opendata.dwd.de/weather/nwp/icon/grib/`), 13 km, 4 Läufe/Tag. Lizenz **CC BY 4.0** (DWD GeoNutzV) → Attribution „Deutscher Wetterdienst, ICON, CC BY 4.0, verändert (Gitter/Quantisierung)“ in `DATENQUELLEN.md`, Legende/Info-Dialog |
| Gitter | Global liegt **nur icosaedrisch** vor (geprüft: keine `regular-lat-lon`-Dateien in `icon/grib/<run>/<var>/`). Wir remappen selbst: Zellmittelpunkte aus `CLAT`/`CLON` (je ~1,3 MB bz2) + KD-Baum → Ziel 0,125°, inverse Distanz der 3 nächsten Zellen. Kein CDO, kein 937-MB-Gitterfile. Fallback falls die Qualität nicht reicht: DWDs `ICON_GLOBAL2WORLD_0125_EASY` (CDO-Gewichte, 50 MB) |
| Regional später (Plan: vorab in der Pipeline nahtlos mit ICON global verblenden, Client sieht nur ein feineres Detailgitter über Europa) | **ICON-EU** (6,5 km, **regular-lat-lon nativ**, 120 h, stündlich bis 78 h) und ICON-D2 (2,2 km, 48 h, regular-lat-lon vorhanden) als optionale Verfeinerung – kein Remapping nötig |
| Backup-Quelle | NOAA GFS 0,25° (gemeinfrei, AWS `noaa-gfs-bdp-pds`, Byte-Range über `.idx`) nur falls DWD ausfällt – nicht in der ersten Ausbaustufe. ECMWF Open Data (0,25°, CC BY 4.0, 3-Tage-Läufe nur 00/12 UTC) bringt gegenüber ICON keine Auflösung → verworfen |
| Dekoder | **Python + `eccodes` (pip-Wheel mit Binärbibliothek) + numpy + scipy `cKDTree`**. Begründung: ICON-GRIB2 ist komprimiert gepackt; ein reiner Node/WASM-Dekoder wäre Eigenbau; ecCodes ist die Referenz. Passt zu bestehenden `scripts/*.py`, kein apt nötig |
| Ablage | eigener Orphan-Branch **`data-wx`** (wie `data-osm`, entkoppelt vom 15-min-Workflow `data.yml`), eigener Workflow `wx.yml` |
| Format | eigenes Binärformat „OWX“: Int16-quantisiert, 2.-Ordnung-Delta entlang x, Zickzack, Byte-Planes, gzip → Client dekodiert mit `DecompressionStream('gzip')` (keine Bibliothek) |
| Clientmodell | Überblick 0,5° (alle Zeiten, 1 Datei/Variable) + Detail 0,125° in 45°-Kacheln (alle Zeiten, 1 Datei/Variable/Kachel), lazy pro Variable |
| Zeitauflösung | 3-stündlich, +0…+72 h (25 Schritte) – identisch zur heutigen Zeitleiste, `SUBSTEPS=3` bleibt |
| Hosting | **Entschieden (2026-10-30): Cloudflare R2 + CDN** (Free-Tier: 10 GB, kein Egress). Pipeline lädt per S3-API hoch, Basis-URL als Konstante – Wechsel zu `data-wx` bleibt möglich. Spike misst weiterhin die Größen |

## 3. Datenquelle im Detail

**Layout** `…/icon/grib/<00|06|12|18>/<var>/icon_global_icosahedral_single-level_<YYYYMMDDHH>_<FFF>_<VAR>.grib2.bz2` (Kleinbuchstaben-Ordner, Großbuchstaben-Name).
Stündlich 000–078, dann 3-stündlich bis 180 (00/12) bzw. 120 (06/18 – für uns egal). Letzte Läufe bleiben ~24 h liegen.

| Orbis-Feld | ICON-Variable | Anmerkung |
|---|---|---|
| `temperature_2m` | `T_2M` (K→°C) | |
| Taupunkt | `TD_2M` (K→°C) | RF und gefühlte Temperatur weiter im Client abgeleitet (RF aus T/Td, Magnus) → `RELHUM_2M` (3 MB × 25) wird nicht geladen |
| `u`, `v` | `U_10M`, `V_10M` | erdbezogen (zonal/meridional) – direkt nutzbar; Geschwindigkeit/Richtung im Client aus u,v |
| `wind_gusts_10m` | `VMAX_10M` | Maximum seit letztem Ausgabeschritt; bis +78 h stündlich → Max über die 3 Stundendateien (Verfeinerung, Schritt 3) |
| `precipitation` | `TOT_PREC` | **akkumuliert seit Laufstart**, 000-Datei leer (183 B). Rate [mm/h] = (acc(t)−acc(t−3))/3; Wert bei t = Mittel der beiden anliegenden Intervalle (kein Halbschritt-Versatz, Summe bleibt erhalten) |
| `cloud_cover` | `CLCT` (%) | |
| `pressure_msl` | `PMSL` (Pa→hPa) | |
| `snow_depth` | `H_SNOW` (m) | |
| `cape` | `CAPE_ML` (J/kg) | gemischte Schicht; `CAPE_CON` wäre nur der Konvektionsanteil |
| (optional) Höhe | `HSURF` (zeitinvariant) | für Höhenkorrektur der Temperatur (Schritt 5) |

Download pro Lauf (3-stündlich, 25 Schritte × 10 Variablen, je ~1,7–4,1 MB bz2): **~0,7 GB**, Actions-Runner schafft das parallel (`curl --parallel`/`aria2c`) in wenigen Minuten.
Veröffentlichung: Läufe sind laut Verzeichnislisting ca. **2 h 40 – 3 h 20** nach Laufzeit vollständig (00-Lauf: 02:39–03:21 UTC). Wir brauchen nur +72 h → etwas früher bereit.

## 4. Verarbeitung (GitHub-Action `wx.yml`)

1. **Zeitplan:** Cron `20 3,9,15,21 * * *` (Lauf + 3 h 20), `workflow_dispatch`. Schritt „Lauf wählen“: neuester Lauf, dessen **letzte benötigte Datei** (`…_072_TOT_PREC`) per HEAD existiert und dessen Run-ID ≠ `latest.json` im Branch; sonst Abbruch ohne Push (Idempotenz). Bis zu 40 min Warteschleife (alle 3 min), danach Fallback auf den vorherigen Lauf (−6 h), danach Exit 0 ohne Änderung.
2. **Download** in `$RUNNER_TEMP`, `bunzip2`, je Datei ~10–15 MB.
3. **Remap-Gewichte** einmal pro Gitter-UUID bauen (`CLAT`/`CLON` → `cKDTree` → Indizes+Gewichte für 0,125° und 0,5°, ~10–20 s) und per `actions/cache` zwischenspeichern.
4. **Dekodieren/Rechnen:** Variable für Variable, Schritt für Schritt (Speicher < 2 GB). Einheiten, Niederschlagsrate, Schnee `NaN→0`, Wind aus u/v unverändert.
5. **Quantisieren** (Tabelle in `latest.json`, pro Variable `scale`, `offset`, Sentinel −32768 = fehlt):
   T/Td/PMSL 0,1 K/hPa-Schritt · u,v,Böe 0,1 m/s · Niederschlag √-/log-Skala (8-bit-Bereich genügt) · Bewölkung 1 % · CAPE √-Skala · Schnee log-Skala.
6. **Schreiben:** `wx/<var>/o.owx` (Überblick), `wx/<var>/t<col>_<row>.owx` (45°×45°-Kacheln = 8×4, Ozean-/leere Kacheln werden zu wenigen Bytes), `latest.json`.
7. **Veröffentlichen:** wie `data.yml`/`cctv-heat.yml` – `git init -b data-wx`, ein Orphan-Commit, `git push -f`. Vorher harte Größenprüfung (Abbruch > 200 MB).
8. Laufzeit-Schätzung 15–25 min, `timeout-minutes: 45`; Public-Repo-Runner (4 vCPU/16 GB) reichen.

`latest.json` (klein, ohne langen Cache geladen):
```json
{ "v": 1, "model": "icon-global", "run": "2026103012", "issued": 1793..., "times": [ms,…25],
  "attribution": "…", "vars": { "temperature_2m": { "scale": 0.1, "offset": -60, "res": 0.125, "min": -80, "max": 60 }, … } }
```

## 5. Ablageformat und Größe

- **OWX-Datei:** Header (JSON: Gitter, Zeiten-Index, scale/offset) + Nutzlast. Pro Schritt 2.-Ordnung-Delta in x-Richtung, Zickzack-Codierung, Byte-Planes getrennt, gzip -9.
- **Gitter:** Überblick 720×361 (0,5°), Kachel 360×360 (45°, 0,125°) mit 1 Zelle Überlappung für bikubische Nähte.
- **Warum nicht PNG/WebP?** Canvas liefert nur 8 Bit; 16-Bit-PNG bräuchte einen eigenen Inflater und trennt Zeitschritte in viele Dateien (~250 pro Lauf). Alle Schritte in einer Datei = Zeitleiste ohne Nachladen.
- **Größenschätzung (UNSICHER, Spike misst):** 4,15 Mio. Zellen × 25 Schritte × ~3–5 Bit ≈ 40 MB je glatter Variable bei 0,125°; Schnee/CAPE/Niederschlag deutlich weniger. Gesamt grob **100–350 MB** – zu viel für sicheres Git-Hosting oben. Gegenmaßnahmen in dieser Reihenfolge: (1) Auflösung je Variable (PMSL 0,5°, Td/CAPE 0,25°; T, u, v, Böe, Niederschlag, Bewölkung, Schnee 0,125°), (2) ab +48 h nur 6-stündlich, (3) Wertepräzision gröber, (4) Hosting auf R2 (kein Repo-Limit, kostenloser Egress, `Range`-Anfragen möglich).
- **Repo-Wachstum:** Orphan-Commit mit Force-Push wie bisher → Verlauf bleibt 1 Commit; alte Läufe existieren nicht. Cache: `raw.githubusercontent.com` ~5 min; Cache-Buster `?r=<run>` in allen Dateinamen-URLs, `latest.json` mit `?t=<5-min-Zeitschlitz>`.
- **Client-Bandbreite:** Überblick pro Variable ~1–3 MB, Kachel ~0,5–2 MB, typische Ansicht (1 Variable, 1–4 Kacheln): **~3–10 MB**, danach Zeitleiste ohne Netz. Variablenwechsel lädt nur die neue Variable. Persistent: `Cache Storage` (nicht localStorage – zu klein), Schlüssel = Run-ID.

## 6. Client-Anbindung

Neue Datei `src/api/wxmodel.ts` (Dekoder, Lader, Kachel-Mosaik); `model.ts` behält Sampler, Interpolation, `SUBSTEPS`, Transformationen.

1. **`ModelGrid` bleibt Typ**; `data` wird zu lazy befüllten Einträgen. Neu: `grid.ensure(vars: ModelVar[]): Promise<void>`; Open-Meteo-Raster implementiert `ensure` als No-op. Abhängigkeiten pro Feld (Tabelle in `model.ts`): `wind`→u,v · `feels`→T,Td,u,v · `humidity`→T,Td · `precipmix`/`snowfall`→precip,T · `pressure`/Isobaren→pmsl · …
2. **Ableitungen** (`derive`) laufen für das jeweils geladene Teilset (Taupunkt/RF umkehrbar über Magnus; Wind = √(u²+v²) bzw. Richtung).
3. **Detail:** `detailRequest(bounds)` liefert statt Punktraster die Menge der 45°-Kacheln im Ausschnitt (+Rand); `getDetailModel` setzt sie zu **einem** rechteckigen `ModelGrid` (Mosaik, dx=0,125°) zusammen → `ModelSampler.detailWeight/feather` bleibt wie es ist. LRU 8 Kacheln × aktive Variablen. Zoomstufen: Kacheln erst ab ca. Zoom 3 (sonst genügt der 0,5°-Überblick).
4. **Globales Modell:** `getGlobalModel()` = 0,5°-Überblick (`wrap=true`); `getRegionalModel` für `fcmap` = Mosaik der 1–2 Kacheln um den Ort (ersetzt 153 Aufrufe).
5. **Fallback:** `getGlobalModel` lädt `latest.json`; bei Netzfehler, Schema `v` unbekannt oder `issued` älter als 30 h → bisheriger Open-Meteo-Pfad (Code bleibt, nach `model-om.ts` verschoben). Anzeige „Quelle: ICON (DWD), Lauf 12 UTC“ bzw. „Open-Meteo (Fallback)“ im Info-Tooltip. Kein Mischbetrieb innerhalb einer Ansicht.
6. **Zeit:** `times` aus `latest.json`; `SUBSTEPS=3`-Mischung, `nearestSubIndex`, `emptyMessage` in `fcmap` unverändert. Beim Laufwechsel (Wiederladen nach 30 min) wie heute `prevTime` → neuer Index.
7. **Organische Körnung** (`organic` in `overlay.ts`): Faktoren sind an `cellDeg` gekoppelt und schrumpfen automatisch mit dem feineren Raster; Feinabstimmung der `warp`/`texture`-Werte nach Sichtprüfung, ggf. Körnung ab 0,125° ganz aus.
8. **Höhenabhängigkeit der Temperatur:** ICON-T_2M gilt für die geglättete Modellorographie. Optional (Schritt 5): `HSURF` als Feld mitliefern und im `wxfield://`-Protokoll pro Pixel `T += 0,0065·(hsurf − dem)` mit Mapterhorn-Terrain-RGB. Erst nach Sichtvergleich mit zoom.earth entscheiden; ohne Korrektur ist bei 13 km die Abweichung kleiner als beim heutigen 15°-Raster.
9. **`omlimit.ts`:** Budget wird nur noch von Fallback/Orts-Ansicht verbraucht – keine Änderung nötig.

## 7. Migrationsplan (je Schritt eigener PR)

| # | Schritt | Aufwand | Ergebnis |
|---|---|---|---|
| 0 | **Spike** (lokal, kein PR): ein Lauf herunterladen, Remapping prüfen (gegen `T_2M` Punktprobe vs. Open-Meteo-ICON), OWX-Größen je Variable/Auflösung messen, Entscheidung Branch vs. R2 | 0,5–1 Tag | Zahlen für Abschnitt 5, Qualität der Nearest/IDW-Remap |
| 1 | `scripts/wx-icon.py` + `wx.yml` + Format-Spezifikation; **nur Temperatur** (+ `latest.json`), Branch `data-wx` | 1,5 Tage | Daten vorhanden, App unverändert |
| 2 | Client-Sampler: `wxmodel.ts`, `ensure`, Überblick+Kacheln, Fallback; **Feld Temperatur** hinter Schalter (`?wx=1` / Einstellung) | 2 Tage | zoom.earth-Vergleich möglich |
| 3 | Übrige Felder in der Pipeline (Td, u/v, Böe-Max, Niederschlag-Rate, Bewölkung, PMSL, Schnee, CAPE) + Client-Abhängigkeitstabelle; Windpartikel/Isobaren prüfen | 2–3 Tage | alle Karten |
| 4 | `fcmap`-Region aus Kacheln, Schalter entfernen (Standard), Open-Meteo-Raster nur noch Fallback, Docs (`DATENQUELLEN.md`, Attribution, `STRUKTUR.md`) | 1 Tag | Umschaltung |
| 5 | Optional: Höhenkorrektur T (HSURF + DEM), ICON-EU-Kacheln 0,0625° für Europa, Böen aus Stundendateien | 2–4 Tage | Feinschliff |
| 6 | Optional: GFS-Fallback in der Pipeline | 1–2 Tage | Ausfallsicherheit |

Reihenfolge ist durch Fallback jederzeit rückrollbar; Schritte 1–2 ändern das Nutzerverhalten nicht.

## 8. Risiken

- **Größe/Hosting** (Abschnitt 5) – größtes Risiko, durch Spike entschärft; Plan B R2.
- **Remap-Qualität** an Küsten (Nearest/IDW vs. konservativ): akzeptabel bei gleicher Zellgröße; Spike vergleicht mit CDO-Gewichten.
- **Veröffentlichungsverzug/Ausfall DWD:** Läufe kommen nach ~3 h; Client zeigt dann den vorherigen Lauf (bis 30 h alt), danach Open-Meteo. DWD-Server hat Drosselungen (Bot-Verhalten) → moderate Parallelität (≤ 8), User-Agent mit Repo-URL.
- **GitHub-Nutzungsbedingungen/Limits:** 4 Pushes/Tag à >100 MB sind grenzwertig; Branch bleibt ein Commit, Größenprüfung im Workflow.
- **Client-Speicher:** Float32 für 0,5° × 25 Schritte = 26 MB/Variable, Kachel 13 MB → LRU begrenzen, Int16 halten und erst beim Sampeln skalieren wäre Alternative, falls mobil knapp.
- **Niederschlag/Böen-Semantik** (Akkumulation, Max-Intervall) – Abschnitt 3; Unit-Tests für die Zeitverarbeitung im Skript.
- **Zwei Datenpfade** bleiben dauerhaft zu pflegen (Fallback).

## 9. Offene Fragen an dich

1. **Hosting-Grenze:** Ist Cloudflare R2 (Konto + zwei Secrets) akzeptabel, falls der Spike > 150 MB ergibt – oder soll der Datensatz dann lieber gröber werden (0,25°)?
2. **Zeitraum:** 3 Tage reichen (PR #128), oder soll die Pipeline gleich bis +120 h (ICON-EU/6-stündlich) vorbereitet werden?
3. **Europa-Boost:** ICON-EU (6,5 km) als zusätzliche Stufe gewünscht (Schritt 5), oder erst nach dem Vergleich mit zoom.earth?
4. **Höhenkorrektur** der Temperatur gewünscht (Schritt 5) – oder ist die modellierte Fläche genug?
5. **Schalter:** Soll der alte Open-Meteo-Pfad nach der Umschaltung dauerhaft als Fallback im Code bleiben (empfohlen) oder später entfernt werden?
6. **Python im Repo:** Ok, dass die Pipeline in Python (`eccodes`) statt Node läuft?

## 10. Verifikation (pro Schritt)

- Pipeline: lokaler Lauf `python scripts/wx-icon.py --run latest --out /tmp/wx`, Punktproben gegen Open-Meteo (`models=icon_global`) – Abweichung T < 0,5 K, Wind < 1 m/s; `workflow_dispatch` im Fork/Branch prüfen.
- Client: `pnpm exec tsc --noEmit`, Sichtprüfung durch dich im Browser (Tibet, Anden, Alpen, Küste) und Vergleich mit zoom.earth; Fallback testen durch umgeleitete/blockierte `data-wx`-URL.
- Daten: Größenbericht je Variable im Workflow-Log, `latest.json`-Alter, Aufrufzahl gegen Open-Meteo (Netzwerk-Tab) = 0 im Normalbetrieb.

## Quellen

- [DWD Open Data ICON](https://opendata.dwd.de/weather/nwp/icon/grib/) · [ICON-EU](https://opendata.dwd.de/weather/nwp/icon-eu/grib/) · [ICON-D2](https://opendata.dwd.de/weather/nwp/icon-d2/grib/) · [CDO-Gewichte/Gitter](https://opendata.dwd.de/weather/lib/cdo/)
- [ECMWF Open Data](https://www.ecmwf.int/en/forecasts/datasets/open-data) · gribmagic/Herbie-Dokus zu Dateinamen
- Nicht erneut geprüft (aus Wissen, im Spike bestätigen): GFS-Bucket/`.idx`, genaue Packungsart der ICON-GRIB2, Inhalt der EASY-Archive.
