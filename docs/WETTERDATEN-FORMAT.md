# Wetterdaten-Format (OWX)

Format der Wetterkarten-Felder, die `scripts/wx-icon.py` aus DWD-ICON-Rohdaten erzeugt und
`.github/workflows/wx.yml` in einen Cloudflare-R2-Bucket lädt. Hintergrund und Migration:
[PLAN-GRIB-WETTERKARTEN.md](PLAN-GRIB-WETTERKARTEN.md). Version 1.

## Dateien im Bucket

```
v1/latest.json                       kurz gecacht (120 s) – Metadaten des neuesten vollständigen Laufs
v1/<YYYYMMDDHH>/<variable>/o.owx     Überblick: ganze Erde, 0,5°
v1/<YYYYMMDDHH>/<variable>/t<c>_<r>.owx   Kachel: 45° × 45°, 0,125° (c = 0…7 von West, r = 0…3 von Nord)
```

Läufe sind unveränderlich (`Cache-Control: immutable`, 1 Jahr). Es bleiben die zwei neuesten Läufe liegen.
Die Variablennamen sind die `ModelVar`-Namen aus `src/api/model.ts` (derzeit `temperature_2m`) sowie `hsurf`.

## Gelände (Temperaturkorrektur)

Die ICON-Temperatur gilt für die geglättete Modelloberfläche (13 km). Für Täler und Gipfel rechnet der Client pro Pixel
`ΔT = 0,0065 K/m · (Höhe_Modell − Höhe_Gelände)`, begrenzt auf ±15 K, mit weichem Auslauf (2°) am Rand des geladenen Gebiets.

- **`hsurf`** (Höhe der Modelloberfläche, m): zeitinvariante ICON-Variable `HSURF`, wie die anderen Variablen unter
  `v1/<lauf>/hsurf/` (ein Zeitschritt, `static: true` in `latest.json`). Gleiches Gitter wie die Temperatur.
- **`dem`** (Geländehöhe, m): `scripts/wx-dem.py` baut sie aus den Terrarium-Kacheln (Mapzen/AWS Open Data, Zoom 5) auf ein
  Lat/Lon-Gitter mit 0,0439° (≈ 4,9 km), 1025 × 1025 Punkte je 45°-Kachel, unter `v1/static/dem/t<c>_<r>.owx`. Meer = 0 m,
  jenseits ±85,05° fehlt der Wert. Gesamt ~7 MB. Auslösen: Workflow `wx.yml` mit Eingabe `dem = true`.
- Fehlt `hsurf` oder `dem`, bleibt die Temperatur unkorrigiert.
- Hinweis zur Höhenquelle: [Mapzen Terrain Tiles](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## Auslieferung

Der Bucket bleibt privat; ausgeliefert wird über den Worker `proxy/wx-worker.js` (R2-Binding `WX`) mit CORS, `ETag`/304 und
`Range`. Seine Adresse ist die Repository-Variable `WX_PUBLIC_URL`. Das Tageslimit von 100 000 Aufrufen des kostenlosen
Worker-Tarifs gilt pro Konto (geteilt mit `orbis-proxy`); Läufe sind unveränderlich und werden vom Browser ein Jahr gecacht,
`latest.json` zwei Minuten. Reicht das Limit nicht, ist der Wechsel auf den bezahlten Worker-Tarif oder eine eigene Domain
nur ein neuer Wert für `WX_PUBLIC_URL`.

## latest.json

```json
{ "v": 1, "model": "icon-global", "run": "2026103012", "issued": 1793361600000, "generated": 1793389577702,
  "times": [ms, …25],
  "attribution": "Deutscher Wetterdienst (DWD), ICON, CC BY 4.0 – verändert (…)",
  "overview": { "res": 0.5, "nx": 720, "ny": 361 },
  "tiles": { "res": 0.125, "size": 45, "cols": 8, "rows": 4, "overlap": 1 },
  "vars": { "temperature_2m": { "icon": "T_2M", "scale": 0.1, "offset": 0, "unit": "°C", "min": -60, "max": 45, "bytes": 39808597 } } }
```

`times`: UTC-Zeitpunkte der Zeitschritte (Laufstart + 0, 3, …, 72 h). Eine unbekannte Hauptversion `v` muss der Client
ignorieren und auf Open-Meteo zurückfallen.

## Gitter

- **Überblick:** `lat0 = 90`, `lon0 = -180`, 0,5°, `nx = 720` (Länge 180° nicht doppelt, `wrap = true`), `ny = 361`.
  Entsteht aus dem 0,125°-Feld per Boxfilter (5×5 Zellen) und jedem 4. Punkt.
- **Kachel:** 361 × 361 Punkte, also 45° plus **eine Zelle Überlappung** nach Osten und Süden, damit bikubische Nähte
  zwischen Kacheln stimmen. `lat0 = 90 − 45·r`, `lon0 = −180 + 45·c`. Die Kachel `c = 7` reicht bis 180° (= −180°).
- Quelle ist das icosaedrische ICON-Gitter (~13 km); remappt wird mit inverser Distanz über die 3 nächsten Zellmittelpunkte
  (`CLAT`/`CLON`), größter Abstand ~16 km.

## Dateiaufbau

| Bytes | Inhalt |
|---|---|
| 0–3 | `OWX1` |
| 4–7 | Länge `H` des Headers, uint32 little-endian |
| 8…8+H | Header als UTF-8-JSON: `var, nt, ny, nx, lat0, lon0, dx, dy, wrap, scale, offset, nodata, pred` |
| Rest | gzip-Strom (`DecompressionStream('gzip')`) |

Wert = `q · scale + offset`; `q = -32768` (`nodata`) bedeutet „fehlt“.

**Nutzlast nach dem Entpacken:** zwei Byte-Ebenen hintereinander, zuerst alle niederwertigen, dann alle höherwertigen Bytes von
`nt · ny · nx` uint16-Werten (Reihenfolge `[t][y][x]`, y von Nord nach Süd, x von West nach Ost).
Jeder uint16-Wert `z` ist ein Zickzack-codiertes Residuum `d = (z >> 1) ^ −(z & 1)` (int16).

**Rekonstruktion** (`pred = "plane-time"`, alle Rechnungen modulo 2¹⁶ auf int16 gewrappt):

1. Pro Zeitschritt `t` die Ebene `s[t]` aus den Residuen `d[t]` zurückrechnen:
   - `s[0][0] = d[0][0]`, erste Zeile: `s[0][x] = s[0][x−1] + d[0][x]`
   - erste Spalte: `s[y][0] = s[y−1][0] + d[y][0]`
   - sonst: `s[y][x] = d[y][x] + s[y][x−1] + s[y−1][x] − s[y−1][x−1]`
2. Zeitliche Summe: `q[0] = s[0]`, `q[t] = q[t−1] + s[t]`.

Der Encoder bildet das spiegelbildlich (erst Differenz zum Vorschritt, dann Plane-Prädiktor). Referenzdekoder: `decode()` in
`scripts/wx-icon.py` (wird im Selbsttest `--selftest` gegen die Quelle geprüft).

## Größe (Temperatur, Lauf 2026103012, 25 Schritte)

33 Dateien, **39,8 MB** (Land-Kachel ~1,6 MB, Ozean ~0,9 MB, Überblick ~0,3 MB). Ein Client lädt für eine Ansicht
Überblick + 1–4 Kacheln, also etwa 2–7 MB je Variable.

## Quelle & Lizenz

Deutscher Wetterdienst (DWD), ICON global, [opendata.dwd.de](https://opendata.dwd.de/weather/nwp/icon/grib/), CC BY 4.0.
Die Daten sind verändert (Remapping, Einheiten, Quantisierung) – die Attribution steht in `latest.json` und muss in der App angezeigt werden.
