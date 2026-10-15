# Radar-Quellen: geprüfte Liste

Stand: 15.10.2026. Alle Einträge hier habe ich **selbst abgerufen und ausgewertet** (Server-Antwort,
Dateistruktur, Werte). Was nicht geprüft ist, steht im letzten Abschnitt und ist als solches
gekennzeichnet. Lizenzangaben stammen von den Anbietern bzw. aus Zoom Earths öffentlicher
Quellenliste (<https://zoom.earth/legal/radar/>), nicht aus einer Rechtsprüfung.

Umrechnung für Reflektivität (dBZ) in Regenrate: Marshall-Palmer, `Z = 200 · R^1,6`,
also `R[mm/h] = (10^(dBZ/10) / 200)^0,625`. Rohreflektivität enthält Störechos (Windparks, Schiffe,
Meer, Randspitzen), einzelne Pixel sollten verworfen werden.

## 1. Rohwerte, offen, ohne Schlüssel (verifiziert)

Alle sind ODIM-HDF5 (H5rad 2.x) oder GeoTIFF mit echten Messwerten und Projektionsangabe. HDF5
liest `h5wasm` (npm) zuverlässig, `jsfive` konnte die SMHI-Datei nicht. Projektion über `proj4`.

| Quelle | Gebiet | Auflösung / Takt | Archiv | Lizenz | Zugriff |
|---|---|---|---|---|---|
| **DWD RV** (Niederschlag, Analyse + Nowcast) | Deutschland und Umland | 1 km, 5 min, Analyse + 24 Schritte bis +120 min | ca. 2 Tage | CC BY 4.0 | `https://opendata.dwd.de/weather/radar/composite/rv/composite_rv_<YYYYMMDD>_<HHMM>.tar` und `composite_rv_LATEST.tar`; je Tar 25 Dateien `…_000-hd5` … `…_120-hd5` |
| **DWD DMAX** (Reflektivität, empfindlicher) | Deutschland und Umland | 250 m, 5 min, nur Analyse | ca. 2 Tage | CC BY 4.0 | `https://opendata.dwd.de/weather/radar/composite/dmax/composite_dmax_<YYYYMMDD>_<HHMM>-hd5` |
| **SMHI** | Schweden und Nordsee/Ostsee | 2 km, 5 min | mehrere Tage (Liste `…/comp.json`), jahrgangsweise bis 2008 | CC BY 4.0 | `https://opendata-download-radar.smhi.se/api/version/latest/area/sweden/product/comp/latest.h5` bzw. `…/comp/<YYYY>/<MM>/<DD>/radar_sweden_comp_<YYYYMMDDHHMM>.h5` |
| **ČHMÚ** (maximale Reflektivität) | Tschechien und Umland | 1,6 km, 5 min | mindestens 7 Tage | CC BY 4.0 | `https://opendata.chmi.cz/meteorology/weather/radar/composite/maxz/hdf5/T_PABV23_C_OKPR_<YYYYMMDDHHMM>00.hdf` (Verzeichnisliste im Ordner) |
| **MeteoSwiss RZC** (Niederschlagsrate) | Schweiz plus Grenzgebiete (Süd-Frankreich, Nord-Italien, Süd-Deutschland) | 1 km, 5 min | 14 Tage | OGD (Quellenangabe) | STAC `https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-radar-precip`, Datei `https://data.geo.admin.ch/ch.meteoschweiz.ogd-radar-precip/<YYYYMMDD>-ch/rzc<YY><DDD><HHMM>rl.001.h5` (`DDD` = Tag im Jahr) |
| **FMI** | Finnland und Umland | 1 km (angefragt), 5 min | über WMS `time=`, Tiefe nicht ermittelt | CC BY 4.0 | GeoTIFF: `https://openwms.fmi.fi/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap&layers=Radar:suomi_dbz_eureffin&styles=raster&bbox=-196593.004,6255329.699,1044176.941,8084432.005&srs=EPSG:3067&format=image%2Fgeotiff&time=<ISO>&width=1241&height=1829`; Zeitliste per WFS `fmi::radar::composite::dbz` |

### Formate und Eigenheiten

- **DWD RV:** Gitter 1100 × 1200, `+proj=stere +lat_ts=60 +lat_0=90 +lon_0=10 +a=6378137 +b=6356752.314245…`,
  `u4`, `gain 0,001`, `offset −0,001`, `nodata 4294967295`, `undetect 0`. Wert = mm je **5 min**
  (× 12 für mm/h). Schwache Echos sind herausgefiltert: bei kurzen, flächigen Schauern zeigt RV oft
  deutlich weniger als RainViewer oder Zoom Earth. Kein Wert außerhalb der Radarreichweite (`nodata`).
- **DWD DMAX:** 4400 × 4800, `u2`, `gain 0,0029298`, `offset −64,0029`, `nodata 65535`, `undetect 0`.
  Zeigt mehr schwache Echos als RV, aber weiterhin dünn.
- **SMHI:** 458 × 881, `+proj=stere +ellps=bessel +lat_0=90 +lon_0=14 +lat_ts=60`. `dataset1/data1` =
  `DBZH`, `dataset1/data3` = `DBZH_CORR` (korrigiert). `uint8`, `gain 0,4`, `offset −30`,
  `nodata 255`, `undetect 0`. Antwort mit `access-control-allow-origin: *`.
- **ČHMÚ:** 598 × 378, Mercator-Projektion (`+proj=merc … +x_0=-1254222.15 +y_0=-6702777.85`),
  `uint8`, `gain 0,5`, `offset −32`, `nodata 255`, `undetect 0`. Viele Einzelpixel-Störungen.
- **MeteoSwiss RZC:** 640 × 710, `+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +x_0=2600000 +y_0=1200000 +ellps=bessel`,
  `float64`, Wert = mm/h direkt, `NaN` = keine Messung, `0` = kein Regen.
- **FMI:** 8-Bit-GeoTIFF in ETRS-TM35FIN (`EPSG:3067`), `0` = kein Echo, `255` = außerhalb der
  Reichweite. **Offen:** Die Zuordnung `Wert × 0,5 − 32 = dBZ` ist die übliche Konvention und passt
  zur Verteilung der Werte, ich habe sie nicht in einer Dokumentation bestätigt.

## 2. Gerenderte Bilder, offen (nur zur Anzeige, keine Rohwerte)

Diese liefern Farbbilder. Brauchbar als Ebene, aber Werte nur über die Farbpalette zurückzurechnen.

| Quelle | Gebiet | Zugriff | Hinweis |
|---|---|---|---|
| DWD WMS (`maps.dwd.de`) | Deutschland | `…/geoserver/dwd/wms`, Layer `dwd:Niederschlagsradar`, `dwd:Radar_wn-product_1x1km_ger`, `dwd:Radar_rv_product_1x1km_ger` | CORS offen; Rendering mit grauer Maske außerhalb der Reichweite |
| Iowa Environmental Mesonet (NEXRAD) | USA (CONUS) | `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png` | NOAA-Daten, ca. 5 min, nur „aktuell“ |
| NOAA `opengeo.ncep.noaa.gov` | Alaska, Hawaii, Puerto Rico, Guam, CONUS | WMS, Layer `alaska_bref_qcd`, `hawaii_bref_qcd`, `carib_bref_qcd`, `guam_bref_qcd`, `conus_bref_qcd` | CORS `*`; MRMS-Reflektivität |
| ECCC GeoMet | Kanada | `https://geo.weather.gc.ca/geomet`, Layer `RADAR_1KM_RRAI`, `RADAR_1KM_RSNO` | 1 km, ca. 6 min; Open Government Licence |
| JMA Nowcast | Japan | `https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json` (Messung), `…N2.json` (Prognose +60 min), Kacheln `…/nowc/<base>/none/<valid>/surf/hrpns/{z}/{x}/{y}.png` | CORS `*`; Zeit aus der JSON-Liste |

## 3. Wichtige Randdaten zu RainViewer (Anzeige, nicht zum Speichern)

- API: `https://api.rainviewer.com/public/weather-maps.json`, Kacheln
  `https://tilecache.rainviewer.com/v2/radar/<hash>/256/{z}/{x}/{y}/2/1_0.png`, **maximal Zoom 7**.
- 13 Messschritte (2 Stunden, 10 min), Nowcast war bei allen Abfragen leer.
- Die Farbrampe wird nicht mehr nach Schema gewählt (alle Schemata liefern dasselbe Bild). Schwache
  Echos sind beige mit Alpha 20 … 190, dann hell- bis dunkelblau (Alpha 255), dann Gelb → Rot → Rosa.
  Wertrückrechnung siehe `src/globe/hdradar.ts` (`rainviewerRate`), die Dunstschwelle liegt bei
  Alpha 100 (Zoom Earth zeigt dort nichts, an vier Kacheln verglichen).
- Nutzung laut Seite „für persönliche und Bildungszwecke“, Bilder dürfen verändert werden,
  **Speichern und Weitergeben ist nicht geregelt**, Verfügbarkeit nicht garantiert.
  Rate-Limit antwortet mit HTTP 429 (ohne CORS-Header).

## 4. Nicht nutzbar bzw. nicht geprüft

| Quelle | Befund |
|---|---|
| KNMI Dataplatform (NL) | HTTP 401, braucht Schlüssel |
| DMI (DK) `opendataapi.dmi.dk` | HTTP 404 beim abgefragten Pfad (kein offener Zugang gefunden) |
| Météo-France `public-api.meteofrance.fr` | HTTP 404 bzw. Schlüssel nötig |
| Italien DPC `radar-api.protezionecivile.it` | HTTP 503 zum Zeitpunkt der Prüfung |
| IMGW (Polen) | Pfad lieferte HTTP 404, kein offener Zugang gefunden |
| MET Norway WMS | HTTP 500; `api.met.no/weatherapi/radar` liefert Einzelbilder je Region, keine Werte (nicht ausgewertet) |
| Met Office (UK) | Schlüssel nötig |
| ECCC WCS (Rohwerte Kanada) | `DescribeCoverage` mit der Layer-ID lieferte einen Fehler, nicht weiter geprüft |
| NOAA MRMS GRIB2 (AWS `noaa-mrms-pds`) | nicht geprüft, bräuchte einen GRIB2-Dekoder |
| Open-Meteo `past_days` für Modellniederschlag (ICON/GFS) | nicht geprüft (Dokumentation nennt bis zu 92 Tage) |

## 5. Zoom Earth als Vergleichsmaßstab (nur beobachtet, nicht zu nutzen)

- Radar: Zeitbereich 72 Stunden (aus dem JSON der Seite), Satellit 10 Tage, Niederschlagskarte
  (ICON/GFS-Modell) ebenfalls bis 10 Tage.
- Kacheln `tiles.zoom.earth/radar/reflectivity/<Datum>/<HHMM>/<Hash>/<z>/<y>/<x>.webp`, 256 px,
  maximal Zoom 7, Reihenfolge `y/x`, Messwert im Grünkanal, Platzhalter `blank.png` ohne Daten.
- Ihre Radardaten stimmen im Norden mit RainViewer zu etwa 70 % überein, in Deutschland liegen sie
  näher beim DWD-RV als bei RainViewer, mit mehr schwachen Echos.
- Ihre Daten sind nicht zur Weiterverwendung gedacht.
