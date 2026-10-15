# 🌧️ Orbis Radar

Automatisch erzeugte Radar-Kacheln für [Orbis](https://github.com/malte9799/orbis). Dieser Branch (`radar`) wird alle ~5 Minuten von [`radar.yml`](https://github.com/malte9799/orbis/blob/main/.github/workflows/radar.yml) neu geschrieben (ein einzelner Orphan-Commit) und von der App über `raw.githubusercontent.com` geladen.

Die Rohdaten der Wetterdienste werden von [`scripts/radar-composite.mjs`](https://github.com/malte9799/orbis/blob/main/scripts/radar-composite.mjs) nach Web-Mercator umprojiziert und als Kachelpyramide abgelegt.

## Format

- Pfad: `<region>/<zeitstempel>/<z>/<x>/<y>.png`, Zoom 2–7, Zeitstempel `YYYYMMDDHHMMZ`
- Kacheln: 512 px, Graustufen-PNG mit dem **Regenwert**, nicht mit Farben: `Byte = round(√(mm/h) · 25)`, `0` = kein Regen / keine Daten (255 ≈ 104 mm/h)
- `manifest.json`: Liste der Regionen, Bounds, Attribution und Frames (`time`, `lead` in Minuten, `id`)
- Die letzten 2 Stunden Beobachtung werden vom vorigen Stand übernommen, dazu die Vorhersage

## Quellen

Alle Quellen sind offene Daten ohne API-Key.

### 🇩🇪 Deutschland — `de`

| | |
|---|---|
| **Anbieter** | [Deutscher Wetterdienst (DWD)](https://www.dwd.de) |
| **Produkt** | [RV-Komposit](https://opendata.dwd.de/weather/radar/composite/rv/) – Niederschlagsradar |
| **Rohdaten** | `composite_rv_LATEST.tar` (25 HDF5-Dateien: Analyse + 5 … 120 min Nowcast) |
| **Auflösung** | 1 km, alle 5 min |
| **Abdeckung** | Deutschland & Umgebung (1,2–19,0 °E, 45,6–56,0 °N) |
| **Projektion** | Polar-Stereographisch (Meridian 10 °E, wahre Länge bei 60 °N) |
| **Lizenz** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de) – © Deutscher Wetterdienst |
| **Status** | ✅ aktiv |

## Weitere Radarquellen in Orbis

Diese Quellen liefert die App direkt (WMS/Kacheln der Anbieter), sie sind nicht Teil dieses Branches:

### 🇺🇸 USA

| | |
|---|---|
| **Anbieter** | NOAA NEXRAD über den [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu) |
| **Produkt** | Regenradar-Mosaik `nexrad-n0q`, ~5 min |
| **Lizenz** | gemeinfrei |

### 🇨🇦 Kanada

| | |
|---|---|
| **Anbieter** | [Environment Canada – MSC GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/) |
| **Produkt** | `RADAR_1KM_RRAI`, 1 km, ~6 min |
| **Lizenz** | [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada) |

### 🌍 Weltweit

| | |
|---|---|
| **Anbieter** | [RainViewer](https://www.rainviewer.com/api.html) |
| **Produkt** | Regenradar weltweit, letzte 2 h (Zoom ≤ 7) |
