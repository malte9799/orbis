# Plan: Meeresplastik und Great Pacific Garbage Patch (GPGP)

> Hinweis: Skripte/Workflows/Branches in diesem Dokument sind historisch; die Pipelines liegen jetzt in Orbismap/data.

Einbau der Quellen aus der GPGP-Recherche (Stand 2026-11-04) in Orbis. Ergebnis: drei neue Ebenen in der
Gruppe **Meer** (`section: 'ocean'`, `cat: 'meer'`) und ein Abschnitt „Meeresplastik“ in [DATENQUELLEN.md](DATENQUELLEN.md).

## Grundsätze

- **Nur freie Lizenzen.** Orbis wirbt mit „100 % kostenlos“ und ist öffentlich gehostet. Übernommen werden nur
  CC BY 4.0, CC0 und US-gemeinfreie Daten (NASA, NOAA). Bilder von The Ocean Cleanup (nur redaktionelle Nutzung), Getty/AP/Reuters,
  Ocean Voyages Institute und GGGI (Konto und Vereinbarung nötig) kommen **nicht** in die App, höchstens als Link.
- **Statische Studien werden zu Assets, nicht zu Snapshots.** Lebreton 2017/2018/2022/2024, Meijer 2021 und Eriksen 2014 ändern sich nie.
  Sie werden **einmal** von einem Build-Skript aufbereitet, landen unter `public/data/plastik/` und laufen über
  `assetUrl()` und das Assets-Manifest (R2, Inhalts-Hash), so wie `data/games` und `data/airports`.
  Für sie gibt es keinen `fetch-data.ts`-Task und keinen orbis-data-Collector.
- **Nur kleine Dateien im Browser.** Kein `geotiff.js` und keine XLS-Bibliothek im Bundle. GeoTIFFs werden vorab zu eingefärbten
  PNG-Bildern (MapLibre-`image`-Quelle mit `coordinates`), Shapefiles und Tabellen zu kompaktem GeoJSON/JSON.
- **Unsicherheit sichtbar machen.** Bandbreiten (z. B. 0,8–2,7 Mio t/Jahr) erscheinen als Spanne mit Modellname,
  nie als einzelne Zahl. Jede Zahl im Popup nennt ihre Studie.

## Aufbereitung: `scripts/plastik-build.py`

Python, weil GeoTIFF, Shapefile und XLS/XLSX in Python mit wenigen Paketen gehen (`rasterio`, `numpy`, `Pillow`,
`pyshp` oder `fiona`, `pandas` + `xlrd`/`openpyxl`). Die Abhängigkeiten kommen in `scripts/plastik-requirements.txt`,
nach dem Vorbild von `wetter-*.py` und `wetter-requirements.txt`.

Downloads laufen über die figshare-API (`https://api.figshare.com/v2/articles/<id>` liefert die `download_url` jeder Datei),
nicht über die HTML-Seiten. Jeder Download kommt in einen eigenen leeren Ordner unter `.cache/plastik/` (gitignored).
Python wird mit `-I` gestartet.

| figshare-ID | Studie | Ausgabe |
|---|---|---|
| 5873142 | Lebreton 2018 | `gpgp-density.png` + `gpgp-density.json` (Bildecken, Farbskala in log10 g/km²), `gpgp-contours.geojson` (aus dem Raster abgeleitet: 1/10/100 kg/km², Level in g/km², vereinfacht, Kleinteile entfernt), `gpgp-history.json` (Messreihe 1970er–2015, Werte innerhalb/außerhalb des Patches), `gpgp-tows.geojson` (Einzelfänge für den Zeitregler) |
| 25674120 | Lebreton 2024 | wird an `gpgp-history.json` angehängt (2015–2022, Fragmente kg/km²); Manta-Trawl-Fänge (917, mit `Lat`/`Lon`/`Year`) auch in `gpgp-tows.geojson` |
| 20202131 | Lebreton 2022 | `gpgp-origin.json` (Länderanteile, Anteil Fischerei, Altersverteilung datierter Objekte) |
| 14515590 | Meijer 2021 | `rivers.geojson` (Flussmündungen, Punkt + t/Jahr; Punkte unter einer Schwelle z. B. 1 t/Jahr verwerfen und auf 4 Nachkommastellen runden, Ziel < 1,5 MB) |
| 14390873 + 1015289 | Eriksen 2014 | `global-density.png` + `.json` (Teile/km², eine Größenklasse oder die Summe), `stations.geojson` (1.571 Stationen) |

Erst die Rohdateien prüfen und dann die Spalten festlegen: Die Tabellenköpfe der XLS-Dateien sind noch unbekannt.
Das Skript soll vorher `--inspect` können, also Spalten und erste Zeilen ausgeben.

Achtung Datumsgrenze: Der GPGP liegt über 180°. Wenn das GeoTIFF in −180…180 vorliegt, für die `image`-Quelle auf Längen
\> 180 (z. B. 135…250) umrechnen. MapLibre kann Bildecken jenseits von ±180 darstellen.
Konturen ebenfalls auf eine durchgehende Länge bringen (`lon < 0 → lon + 360`).

### Rohdaten (Inspect-Ergebnis)

Alle sechs Artikel stehen laut figshare-API unter CC BY 4.0. Aufruf: `.cache/plastik/venv/bin/python -I scripts/plastik-build.py [--inspect]`.

| Datei | Inhalt / Felder | Einheit, CRS | Entscheidung |
|---|---|---|---|
| 5873142 `MassConcentrationAllSizes.tif` | 201 × 126 Zellen à 0,2°, Länge −160…−119,8, Breite 20…45,2; nur ein Band, `-inf` = keine Konzentration, NoData −9999 | log10 g/km², EPSG:4326 | Länge +360 (200…240,2), nach Web-Mercator resampled (Faktor 6). Skala 3…5,2 (1 kg/km² bis Rastermaximum; Werteverteilung log10: Median 2,7, 75 % 3,8, 90 % 4,5, 99 % 5,0, max 5,23), Fade 2,6…3,2, darunter transparent |
| 5873142 `GPGP_contours.shp` | 192 Polylinien, Felder `ID`, `ELEV` (1/2/3) | EPSG:4326, Länge −160…−120,5 | **nicht übernommen.** Am Raster gemessen liegen die Pegel bei log10 2,18 / 3,18 / 4,18 g/km² (Median 152 / 1.520 / 15.000 g/km², IQR ±0,04), also nicht bei 10/100/1000 g/km² (so war `ELEV` zuerst gelesen worden) und nicht bei runden Werten; `ELEV` = 3 lag fast parallel innerhalb der 10-kg/km²-Linie. Stattdessen Isolinien 1/10/100 kg/km² aus dem Raster abgeleitet, Länge +360 |
| 5873142 `Lebreton2018_HistoricalDataset.xls` | 3.532 Netzfänge 1972–2015: Year, Longitude, Latitude, Sampling type, Mesh Size, Numerical (#/km²), Mass (g/km²), `Inside GPGP?` (0/1) | g/km², Teile/km² | Mittelwert und Median je Jahr und innen/außen, Jahre mit n < 3 verworfen; Masse und Anzahl als getrennte Reihen. Zusätzlich jeder Fang als Punkt in `gpgp-tows.geojson` (`y`, `m`, `n`, `s`) |
| 25674120 `Lebreton2024_concentration_data.xlsx` | Blätter Manta trawl (918), Mega trawl (163), Aerial survey (75), Cleanup system (41); `Year`, `In NPGP`, `CD1…7` (Teile/km²), `WD1…7` (g/km²), je Typ H/N/P/F | g/km², Teile/km² | Reihen: Manta (Summe Klasse 1–6, innen/außen, 2015–2022), Luftbild (`WD7`), Cleanup (`WD567`); Mega trawl nicht übernommen |
| 20202131 `…Raw evidence.xlsx` | 354 Objekte: `Object`, `OSPAR ID`, `Logo/company/text`, `Language`, `Origin` (232 befüllt), `Production year` (39 befüllt) | – | Länderanteile = Anteil an den 232 Objekten mit Herkunft; Alter nur Produktionsjahr (Fund 2019). Keine Spalte „Fischerei“, siehe Abweichungen |
| 14515590 `Meijer2021_midpoint_emissions.shp` | 31.819 Punkte, einziges Feld `dots_exten` (t/Jahr, Mid-Point-Szenario); kein Fluss- oder Landname | t/Jahr, EPSG:4326 | Schwelle 3 t/Jahr (11.696 Punkte, 98,5 % der Menge, 1,3 MB), Rang `r`, Menge `t` |
| 14390873 `count_density_size1…4.tif`, `weight_density_size1…4.tif` | 1801 × 901, 0,2°, Länge 0…360, Breite ±90, ohne NoData; Hintergrundwert 0,702 (5 Teile/km²) auch an Land | log10 Teile/km² bzw. g/km², EPSG:4326 | Summe der vier Anzahl-Klassen (Gesamtzahl 5,15 Billionen, passt zu „5 Billionen“; Gewichte summieren sich zu ~263.000 t), Länge nach −180…180 gerollt, ±85°, Mercator, Hintergrund transparent |
| 1015289 `Plastic Marine Pollution Global Dataset.xlsx` | 1.571 Stationen: Date, Latitude, Longitude, `CD1–4` (Teile/km²), `WD1–4` (g/km²), Sea State, Source | – | Properties `d` (Jahr-Monat), `n` (Summe Teile/km²), `w` (Summe g/km²) |

Größenklassen Eriksen: 0,33–1 / 1–4,75 / 4,75–200 / > 200 mm (Spalten `CD1–4`).
Abweichungen und offene Punkte:
- Der Anteil Fischerei (75–86 %) bezieht sich laut Studie auf die Masse des schwimmenden Plastiks und ist aus der Objekttabelle nicht ableitbar. `gpgp-origin.json`: `fishing.share` mit `verified: false`.
- Länderanteile aus den Daten: JP 33,6 %, CN 32,3 %, KR 9,9 %, US 6,5 %, TW 5,6 % (Plan: 34/32/10/7/6), dazu CA 4,7 %. Ältestes Objekt 1966 (39 datierte Objekte).
- Der Patch (~1,6 Mio km²) ist ≥ 10 kg/km². Das Skript leitet die Isolinien 1.000 / 10.000 / 100.000 g/km² aus dem Raster ab (10.000 = `boundary: true`): 1,93 Mio km² im Rasterausschnitt (+20 % gegenüber 1,6, Zellenfläche, Rastervariante der Studie), Mitte lon −141,61 lat 32,22. Die 1000-g/km²-Kontur umfasst 4,3 Mio km². Kleine geschlossene Ringe (< 2.000 km²) und kurze offene Linien (< 150 km) entfallen (1.000: 75 → 3 Linien, 10.000: 27 → 4, 100.000: 21 → 3).
- Netzfänge für den Zeitregler: 4.447 Punkte, 24 Jahre mit Daten (1972–2022, Lücken), davon 1.544 mit Masse 0 g/km² (grau gezeichnet). Methoden `s`: N Neuston, M Manta, O anderes Netz, U ohne Typ (alle Lebreton 2018, Rohwerte) und T Manta-Trawl 2015–2022 (Lebreton 2024). Für 2015 überschneiden sich beide Datensätze möglicherweise (nicht auf Doppelte geprüft).
- Rasterbereich der Lebreton-Daten endet bei −160° (200°), der Patch reicht nach Westen darüber hinaus.
- Die 2018er-Reihen (Netze 0,3–0,5 mm, Rohwerte) und 2024er-Reihen (0,5–500 mm, vertikal korrigiert) sind nicht direkt vergleichbar (2015: ~1.200 vs. ~13.000 g/km² im Patch).

## Ebene 1: `plastik` „Plastik im Meer“ (global + GPGP)

`src/globe/layers/defs/plastik.ts`, Vorlage `chlorophyll.ts` (Raster) + `tides.ts` (Klick).

- **Weit herausgezoomt:** Eriksen-2014-Dichtebild als `image`-Quelle, Deckkraft 0,7; ab Zoom 2 → 2,5 blendet es auf 0,1 aus, ab 3,5 ist es weg (sonst Schleier über dem Satellitenbild).
- **Ab Zoom 2,5 im Nordpazifik:** Lebreton-2018-Bild darüber (Deckkraft 0,88, Skala 1 kg/km² bis Maximum) und die drei Isolinien 1 / 10 / 100 kg/km² als `line` (10 kg/km² = Patch-Grenze, Property `boundary`, Beschriftung „10 kg/km² – Patch-Grenze“).
- **Zeitregler Netzfänge:** `gpgp-tows.geojson` (Punkte, `circle`, ab Zoom 2, Farbe nach log10 Masse in g/km² mit der Skala des GPGP-Bilds, grau bei 0). Der vorhandene Zeitstrahl von `views/globe.ts` (Radar/Vorhersage/Wahlen) bekommt einen weiteren Modus `plastik`: ein Schritt je Jahr mit Daten (Jahre ohne Fänge entfallen), Abspielen, „Jetzt“ = letztes Jahr. Gezeigt werden alle Fänge **bis einschließlich** des gewählten Jahres, ältere schwächer (Deckkraft 0,4), das gewählte Jahr kräftig – so bleibt die Verteilung lesbar und die Zunahme der Abdeckung sichtbar. Zustand in `shared/plastiktime.ts`, Daten werden erst beim Einschalten der Ebene geladen. Wie bei Wahlen übernimmt die Ebene den Zeitstrahl, solange sie an ist. Klick auf einen Fang: Jahr, Masse, Teile, Methode, Quelle, Hinweis zur fehlenden Vergleichbarkeit 2018- und 2024-Werte.
- **Marker der Müllstrudel** (Punkte mit Label): Nordpazifik (GPGP), Nordatlantik, Südpazifik, Südatlantik, Indik,
  Mittelmeer, Arktis, Great Lakes. Die Werte stehen als Daten in `public/data/plastik/patches.json`, aus Tabelle 5 der Recherche,
  jeweils mit Studie und DOI.
- **Klick auf GPGP:** Steckbrief mit Fläche, Masse, Anteil Fischernetze und Quelle (TOC-Zahlen nur als Text mit Herkunft),
  Liniendiagramm aus `gpgp-history.json` mit `src/chart.ts` (Reihen nach `method` getrennt zeichnen, nie zu einer Linie verbinden) (Dichte innerhalb/außerhalb, 1970er → 2022),
  Link auf NASA SVS 4174/4375 („Strömungsmodell als Video“). Kein eigenes Hosting nötig, das MP4 wird bei Bedarf direkt von svs.gsfc.nasa.gov eingebettet.
- **Klick auf andere Strudel:** Dichte, Studie, ob Rohdaten offen sind (IEDA/PANGAEA-Link).
- Attribution: „Lebreton et al. 2018 (CC BY 4.0) · Eriksen et al. 2014 (CC BY 4.0)“.

Stand Umsetzung (Schritt 3, `defs/plastik.ts`, `shared/plastikchart.ts`, `shared/plastikgeo.ts`): Bildquellen entstehen beim ersten Einschalten (nicht beim Start),
die Ecken stehen als Konstanten im Code und werden von `shared/plastik.test.ts` gegen die JSON geprüft. GPGP-Bild und Isolinien ab Zoom 2,5, das globale Bild blendet dort aus.
Offene Punkte:
- Längen > 180 (GPGP-Bild, Konturen) funktionieren in der 2D-Karte (vom Nutzer geprüft); im Globus nicht geprüft.
- Korrektur nach Nutzertest: mitgelieferte Konturen verworfen (falsche Pegel, siehe Rohdaten), Kleinteile entfernt, globales Bild stärker ausgeblendet, GPGP-Skala 3…5,2 mit Deckkraft 0,88.
- Klick in die Patch-Fläche nutzt den geschlossenen Ring der 10-kg/km²-Linie als unsichtbares Polygon (Fläche des Rasters, nicht der Studie).
- `fishing.verified` ist `false`: die Zahl steht als „(Studienangabe)“ im Panel. Anteil Fischerei vor Veröffentlichung gegen das Paper prüfen.
- `InfoPanelData` hat ein neues optionales Feld `html` (vertrauenswürdiges HTML, hier das SVG-Diagramm).
- Stationen (`stations.geojson`) sind noch nicht in der Ebene.

## Ebene 2: `plastikfluesse` „Plastik aus Flüssen“

`src/globe/layers/defs/plastikfluesse.ts`, Vorlage `rivers.ts` / `ports.ts`.

> ✅ Umgesetzt: `defs/plastikfluesse.ts` + `shared/plastikfluesse.ts` (Test daneben). Ein `circle`-Layer, Radius/Farbe nach log10(t/Jahr); Rang-Stufen (Zoom <3: r ≤ 300, <4,5: r ≤ 2000, darüber alle) stecken in den Zoom-Stops des Radius (Radius 0 = noch nicht fällig). Klick: t/Jahr, „Platz X von 31.819“, Studienspanne, Links auf Paper (10.1126/sciadv.aaz5803) und figshare 14515590. Länder-Einfärbung (OWID) bleibt optional.

- Meijer-2021-Mündungen als `circle`, Radius und Farbe nach t/Jahr (log). Ab niedrigem Zoom nur die größten
  (Filter auf eine Rangspalte, die das Build-Skript setzt).
- Klick: Fluss/Land, t/Jahr, Hinweis „Modellschätzung, Spanne 0,8–2,7 Mio t global“.
- Optional als zweiter Schritt: Länder nach Plastikeintrag einfärben. Die Werte stammen aus OWID `plastic-entering-ocean.csv`
  und `mismanaged-plastic-waste-per-capita.csv` (CC BY 4.0, Abruf mit `.csv`-Suffix, ins Build-Skript übernehmen).
  Die Ländergeometrie stammt aus `public/data/games/countries.json` (Natural Earth, gemeinfrei), es kommt keine neue Geometrie hinzu.
  OWID wird **nicht** per iframe eingebettet, das passt nicht zur Karten-UI.

## Ebene 3: `plastikherkunft` „Herkunft des GPGP-Plastiks“

`src/globe/layers/defs/plastikherkunft.ts`, Vorlage `geldfluesse.ts` (Bögen mit `GeoLine`/`arcPoints`).

- Bögen von Japan, China, Südkorea, USA und Taiwan zum GPGP-Zentrum, Breite nach Anteil (34/32/10/7/6 %), Rest als „andere/unbekannt“.
- Legende: 75–86 % Fischerei. Klick auf einen Bogen: Anteil, Art des Nachweises (Marke, Sprache), Studie.
- Hinweis im Popup: Der Tsunami in Japan 2011 erklärt nur einen Teil (NOAA-TM-Link).
- Bögen über die Datumsgrenze: prüfen, ob `arcPoints` den kurzen Weg über 180° nimmt.

> ✅ Umgesetzt: `defs/plastikherkunft.ts` + `shared/plastikherkunft.ts` (Test daneben). Sechs Bögen (JP, CN, KR, US, TW, CA) von Ankerpunkten (Küste/Hafen, Konstante `ANCHORS`, nicht Landesmitte) zur GPGP-Mitte aus `patches.json`; Breite 1,5–8 px linear nach Anteil; übrige Länder als „andere“ nur im Panel. Klick auf Bogen/Land: Anteil, n, Grundlage, Hinweise (Japan: Tsunami-Link NOAA); Klick auf GPGP: alle Länder. Datumsgrenze: `arcPoints` führt die Länge vom Start aus fortlaufend weiter (Ende bei 218,4° statt −141,6°), der Test prüft Längensprung < 10° und dass alle Bögen im Streifen Start–Ziel bleiben; keine Normierung im Layer nötig. Offen: Endpunkt der asiatischen Bögen liegt bei 218° (in der 2D-Karte in der rechten Weltkopie, wie bei Geldflüsse), Globus und 2D vom Nutzer zu prüfen.

## Treibbojen (Teil 1): `treibbojen` „Treibbojen (NOAA)“

> ✅ Umgesetzt (Stand 2026-11-04, vom Nutzer noch nicht im Browser geprüft): `defs/treibbojen.ts`, `shared/treibbojen.ts` (Dekodierung, Interpolation, Zeitrechnung), `shared/treibbojentime.ts` (Modus/Zeit für den Zeitstrahl), `geo3d/swarm.ts` (`GeoSwarm`: Punkte + Spuren für Globus und flache Karte; `GeoPoints` kann nur den Globus). Stand 2026-11-04 (später): Kopplungsschalter durch Reiter/Fokus ersetzt (siehe unten).

- **Daten:** echte Bahnen des NOAA Global Drifter Program, ERDDAP-Datensatz `drifter_6hour_qc` (DOI 10.25921/7ntx-z961). **Lizenz laut Metadaten CC BY 4.0, nicht gemeinfrei** – die Quelle muss genannt werden (Legende, Panel, DATENQUELLEN.md). `scripts/drifters-build.py` (nur Standardbibliothek) lädt per tabledap statt der NetCDF-Dateien (eine Datei je Boje, ~29.000 Dateien à ~300 KB mit allen Variablen): `ID,time,latitude,longitude` mit `orderByClosest("ID,time/5days")` dünnt serverseitig auf einen Punkt je 5 Tage aus (~4 KB je Boje); 40 Bojen je Request, sequentiell mit 2 s Pause, jeder Block gecacht in `.cache/drifters/raw/blocks/`. Fallstrick: `"`, `|` und `>=` müssen kodiert sein, sonst HTTP 400 ohne Text.
- **Auswahl:** 27.659 Bojen, 23.747 ab 1979 mit ≥ 60 Tagen; je Startzelle 10° × 10° (465 Zellen) höchstens 7 Bojen, gleichmäßig über das Startdatum gezogen → 3.000; Bahn endet vor der ersten Lücke > 30 Tage und nach 5 Jahren; 2.992 Bahnen, 307.318 Punkte, 1.212 KB `tracks.bin` + 29 KB `meta.json` (IDs, Credit, DOI, Zeitspanne). Format (Little-Endian, Uint16 mit Skala 180, Zeit implizit im 5-Tage-Raster) steht im Skriptkopf.
- **Ebene:** `GeoSwarm` hält alle Punkte einmal auf der GPU; der Fragment-Shader zeigt von jedem Segment den Teil zwischen `jetzt − 90 Tage` und `jetzt` (Spur endet genau am Punkt, Deckkraft nimmt mit dem Alter ab), die ~3.000 Punkte setzt die CPU je Frame (lineare Interpolation, kürzester Weg über 180°). Schritte über die Datumsgrenze fehlen in den Spuren. Auf der flachen Karte in drei Weltkopien. Klick auf eine Boje: Panel (ID, Aussetzen, letzte Position, Laufzeit, Strecke, Hinweis „alle 5 Tage“, Link auf ERDDAP/DOI) und die ganze Bahn als weiße Linie.
- **Zwei Modi** (Umschalter im Kopf des Zeitstrahls, `Echte Zeit | Gemeinsamer Start`): **Echte Zeit** (Standard seit 2026-11-04, da bei „Gemeinsamer Start“ alle Punkte am Tag 0 überall zugleich erscheinen und das unrealistisch wirkt) und **Gemeinsamer Start** (wie NASA „retimed“): alle Bojen beginnen bei t = 0 ihrer Bahn, 1 Jahr in 5 s, Schleife über 4 Jahre; **Echte Zeit**: 1979 → 2025, 1 Jahr in 2,5 s, nur aktive Bojen, Zeitstrahl beginnt am ersten Datentag. Zeitstrahl-Modus `treibbojen` in `views/globe.ts` (Priorität Wahlen > Plastik > Treibbojen); Abspielen/Pause schaltet nur um, die Ebene führt die Zeit selbst (`tickDrift`). Läuft nur bei eingeschalteter Ebene und sichtbarem Fenster.
- Offen: Globus, Überblendung und flache Karte vom Nutzer prüfen (Shader nicht im Browser getestet); die Strecke ist eine Untergrenze (5-Tage-Punkte); Bojen vom Typ „aground“ o. ä. werden nicht ausgesondert.

### Treibbojen (Teil 2): `treibmodell` „Treibgut-Modell“

> ✅ Umgesetzt (Stand 2026-11-04, vom Nutzer noch nicht im Browser geprüft): `scripts/currents-build.py`, `shared/treibmodell.ts` (Feld, Advektion, Quellen und Freisetzung; Test daneben), `shared/treibmodelltime.ts`, `defs/treibmodell.ts`, Modus `treibmodell` im Zeitstrahl, `GeoSwarm` im „Live“-Modus.

- **Quelle:** NOAA/AOML Global Drifter Program, Klimatologie der Nahoberflächengeschwindigkeit (Laurindo, Mariano & Lumpkin 2017, Deep-Sea Res. I, doi:10.1016/j.dsr.2017.04.009), ERDDAP `drifter_annualmeans` (Version 3.10, Daten bis 28.02.2023, 0,25°, −72,875…84,875). **Lizenz CC BY 4.0** laut Metadaten (`license`). Enthält den gesamten Drifter-Anteil (geostrophisch + Ekman), deshalb konvergiert Treibgut in den Wirbeln. Die AOML-HTML-Seiten (`aoml.noaa.gov/phod/gdp/...`) sind per CloudFront gesperrt, ERDDAP geht.
- **Datenweg:** ein einziger griddap-Request `…/griddap/drifter_annualmeans.csv?U,V` (38 MB CSV, 8 s), gecacht in `.cache/currents/raw/`. Jahresmittel statt Monatsmittel (kein Jahresgang im Modell).
- **Aufbereitung:** 0,25° → 0,5° (Mittel der gültigen Werte je 2×2 Zellen), kleine Lücken im Meer (zusammenhängende fehlende Gebiete < 150 Zellen, 852 Zellen) per Nachbarmittel gefüllt, Land/Meereis/Pole bleiben „ohne Wert“. **720 × 309 Zellen, −72,75…81,25° N, Int16 (mm/s), Sentinel −32768, 869 KB** (`public/data/currents/mean.bin` + `meta.json`). Meer 59,5 % der Zellen, mittlere Geschwindigkeit 0,12 m/s, Maximum 1,49 m/s (Golfstrom).
- **Modell:** Feld bilinear (Längen periodisch, Landzellen fallen aus der Gewichtung), RK2-Mittelpunkt in Grad, 1 Tag je Schritt, dazu eine träge Zusatzgeschwindigkeit je Partikel (Random Flight / Ornstein-Uhlenbeck, seit 2026-11-04; vorher weißes Rauschen mit K = 1.000 m²/s, ≈ 13 km Zufallssprung je Tag, das die Spuren zickzack zeichnete): Wirbelgeschwindigkeit (u′, v′) mit Lagrange-Zeitskala T_L = 4 Tage (`EDDY_TL_DAYS`), σ = √(K/T_L) = 3,4 cm/s, K = σ²·T_L = 400 m²/s (`DIFFUSIVITY`); gleiche Streuung wie ein Random Walk mit K auf Skalen ≫ T_L, aber die Richtung ändert sich über Tage, nicht von Schritt zu Schritt. Start aus der stationären Verteilung bei Freisetzung/Saat, Prüfpunkte enthalten u′/v′. Mittlere Drehung der Richtung zwischen zwei 2-Tage-Proben 82° → 32°. Die geringere Diffusion füllt die Strudel etwas langsamer (Live, 10 Jahre: Nordpazifik 9,1 → 5,1 mal Flächenanteil), `HIST_PER_DAY_REF` 15 → 11, damit der Pool 2020 wie zuvor fast voll ist. Treibgut, das in einer Landzelle (nächste Zelle ohne Wert) landet, ist „gestrandet“: bleibt an der letzten Meeresposition stehen und blendet aus. Breite auf den Gitterrand geklemmt. **Freisetzung (seit 2026-11-04, vorher 5.000 Partikel gleichmäßig über das Meer gesät):** Das Meer ist an Tag 0 leer; täglich treten 6 Partikel (`RELEASE_PER_DAY`, 21.900 je Lauf) an den Flussmündungen ein (Meijer et al. 2021, CC BY 4.0, `rivers.geojson`, Auswahl gewichtet nach `t`). Jede Mündung wird einmal auf die nächste Meereszelle des Feldes verschoben (höchstens 4 Zellen; bis 2 Zellen weiter, wenn dort offenes Wasser statt Küstenzelle liegt, sonst strandet fast alles sofort; 10.816 von 11.696 Mündungen behalten eine Quelle), Startpunkt zufällig in der Zelle. Pool von 8.000 Slots (`PARTICLES`); ein gestrandetes Partikel gibt seinen Slot frei, ist der Pool voll, wird das Partikel am Zeiger ersetzt, die Freisetzung endet nie. Nicht modelliert: Wind-Slip, Stokes-Drift, Wellen, Jahreszeiten, Wirbel (außer als Diffusion), Abbau, Fischerei, Eintrag über die Zeit (konstante Rate).
- **Test mit dem echten Feld** (`treibmodell.test.ts`, Seed 7, 10 Jahre mit 6 Partikeln je Tag, seit der Zusatzgeschwindigkeit K = 400): Nach 10 Jahren sind ≈ 3.400 Partikel im Meer, ≈ 84 % der freigesetzten sind gestrandet (die Mündungen liegen an der Küste; mittleres Feld mit 0,5° Auflösung). Der Nordpazifik-Kasten (22–40° N, 160–120° W) enthält ≈ 10 % der treibenden Partikel bei 2,3 % Flächenanteil (Faktor ≈ 4), der Test verlangt mehr als das 2,5-Fache und Partikel im offenen Nordpazifik fern jeder Mündung. Rechenzeit ≈ 0,4 ms je simuliertem Tag in Node.
- **Darstellung:** `GeoSwarm` bekommt einen Live-Modus (`setLive`, `pushLive`, `resetLive`, `setDots(…, now)`): Ringpuffer der letzten 24 Proben (alle 2 simulierten Tage, vorher 10 alle 5 Tage; 12,8 MB statt 5,6 MB GPU-Puffer) als dynamische Spurgeometrie, das Endstück bis zum Punkt wird je Frame neu geschrieben, hochgeladen werden nur geänderte Blöcke. Gleicher Shader und gleiche Zeitlogik wie bei den echten Bojen, Spur 46 Tage; Segmente über die Datumsgrenze oder an ausgeblendeten Punkten entfallen. `resetLiveSlot(i)`: wird ein Slot für eine neue Freisetzung wiederverwendet, löscht es dessen alte Spur im Ringpuffer und merkt, dass der Punkt neu ist, damit keine Linie von der alten Position zur Flussmündung entsteht.
- **Zeitraffer:** 1 Jahr in 3 s (Live-Modus; der frühere 10-Jahres-Lauf mit Halt und Neustart ist entfallen, damit auch der Zeiger-Ersatz im vollen Pool: es geht immer das älteste Partikel). Schritte im Hauptthread, Budget 2 ms je Frame beim Abspielen (sonst läuft die Zeit langsamer).
- **Live-Modus (Standard, seit 2026-11-04):** Neben „Historisch ab 1950“ der Modus „Live“ (nur in der Ansicht des Modells, `treibmodelltime.ts`: `mode`, `restarts`). „Live“ läuft endlos: Beim Start werden `LIVE_SEED` = 5.000 Partikel nach der beobachteten Oberflächenverteilung gesät (Eriksen et al. 2014, CC BY 4.0), danach treten `LIVE_PER_DAY` = 8 je Tag an den Flussmündungen ein (wie bisher, nach `t` gewichtet). **Startverteilung:** `scripts/treibgut-seed-build.py` (eigenes Skript, liest `count_density_size1..4.tif` aus `.cache/plastik/raw/14390873/`, Land per Strömungsfeld maskiert) schreibt `public/data/plastik/treibgut-seed.json` (≈ 80 KB, 1°-Gitter, ein Byte je Zelle = log10-Gewicht, Base64; 31.787 Zellen mit Gewicht; Gewicht = (Teile/km² − Hintergrund) x Zellfläche). Im Browser wird die Zelle nach Gewicht gewählt, der Punkt zufällig darin; liegt er auf Land, bis zu 6 neue Versuche, dann nächste Meereszelle (`snapToSea`, höchstens 4 Zellen, sonst wird die Zelle übersprungen). Fehlt die Datei, startet Live mit leerem Meer. **Obergrenze:** der Pool (`PARTICLES` = 8.000); ist er voll, geht das älteste Partikel (kleinstes `born`, die gesäten haben zufällige negative Alter), sein Slot geht an den neuen; `resetLiveSlot` löscht die Spur. Gestrandete Partikel blenden aus und geben den Slot sofort frei (kein Auswurf nötig). Messung mit dem echten Feld (Seed 5, 30 Jahre in Node): Meer voll nach ≈ 9,7 Jahren, die gesäten Partikel sind nach ≈ 20 Jahren alle ersetzt (ein Teil, ≈ 30 %, strandet früher an Küsten), gestrandet insgesamt 40 % nach 1 Jahr, ≈ 77 % nach 10 Jahren. Rechenzeit ≈ 1,7 ms je Tag bei 5.000 bis 8.000 Partikeln in Node (Budget 2 ms je Frame: bei vollem Meer läuft die Zeit dann etwas langsamer als 1 Jahr in 3 s). Der Schieber ist im Live-Modus gesperrt; „Jetzt“ sät neu (neuer Zufall).
- Offen: Globus, flache Karte und Zeitstrahl vom Nutzer prüfen; Rechenzeit je Frame im Browser nicht gemessen (Test: ≈ 0,2 µs je Partikelschritt in Node, ≈ 2 ms für 5.000 Partikel und 2 Tage).

### Modell-Umriss pro Jahr (experimentell)

> ✅ Umgesetzt (Stand 2026-11-04, vom Nutzer noch nicht im Browser geprüft). **Keine Messung:** Es gibt keine gemessenen historischen Umrisse des GPGP. Der Umriss ist eine eigene Modellrechnung (`scripts/gpgp-model.py`, einmalig, Laufzeit ≈ 7 min) und überall als „experimentell“ beschriftet.

- **Dateien:** `public/data/plastik/gpgp-model-outlines.geojson` (ein Feature je Jahr 1950–2022, `y`, `a` = Fläche km², MultiLineString, Längen 120…260, 39 KB) und `gpgp-model-meta.json` (Parameter, Quellen, Kalibrierung). Ebene `plastik`: Linie `plastik-model-outline` (cyan `#80deea`, gestrichelt, Filter auf das Zeitstrahl-Jahr) mit Beschriftung ab Zoom 3, Klick-Panel mit Annahmen; die feste 10-kg/km²-Grenze (Lebreton 2015) bleibt daneben. Zeitstrahl (`shared/plastiktime.ts`): Jahre = Modelljahre ohne Lücke ∪ Fangjahre, Kopf „Jahr · Modell-Umriss: X Mio. km² · Netzfänge: N“, Abspielen 0,6 s je Jahr. Keine Abdunklung der Heatmaps.
- **Strömung/Dynamik:** mittleres Feld `data/currents/mean.bin`, dieselben Annahmen wie `treibmodell.ts` (bilinear, RK2, K = 1.000 m²/s, Stranden = Partikel verschwindet), Zeitschritt **2 Tage** statt 1 (Laufzeit; Diffusion über sigma = √(2 K dt) zeitschrittunabhängig), numpy-vektorisiert.
- **Quellen:** Meijer-Mündungen (Längen 100° O…70° W, Breiten 10° S…65° N: 7.145 von 11.696 Mündungen, 627 von 990 kt/Jahr), gezogen nach `t`, Start in der nächsten Meereszelle. **Fischerei (75–86 % der GPGP-Masse laut Lebreton 2022) ist in der ausgelieferten Variante NICHT modelliert.** Eintrag je Jahr ∝ weltweiter Produktion (OWID/Geyer 2017, 1950–2019; Geyer endet 2015, die OWID-Werte ab 2016 sind exakt +5 %/Jahr fortgeschrieben; 2020–2022 linear aus 2015–2019).
- **Abbau:** Masse ∝ exp(−Alter/τ), τ = 15 Jahre (Annahme, Absinken/Zerfall; Test 10 / 20). 6.000 Partikel je Jahr und Quelle in 12 Monatsstapeln, Jahresmittel der Dichte (Stichprobe alle 4 Tage), 0,5°-Gitter 120° O…100° W / 0…60° N, Gauß 1 Zelle.
- **Kalibrierung:** eine feste Dichteschwelle, so dass die zusammenhängende Fläche um den Dichtekern (Suchradius 2.500 km um −141,6° / 32,2°) 2015 = 1,6 Mio. km² ist (Ergebnis 1,598).
- **Plausibilität (τ = 15, nur Flüsse):** Mitte 2015 bei −141,1° / 31,9° = **56 km** von der Lebreton-Mitte; IoU mit der 10-kg-Fläche (Raster-Ausschnitt 200…240° O, Referenz 1,92 Mio. km²) **0,70** (Überdeckung der Referenz 0,75, Modellanteil in der Referenz 0,91). Fläche je Jahrzehnt (Mittel, Mio. km²): 1950er 0, 1960er 0, 1970er 0, 1980er 0,17, 1990er 0,55, 2000er 1,03, 2010er 1,68, 2020er 2,44. Erste Fläche über der Schwelle: **1982**. Empfindlichkeit τ: 10 a → Mitte 89 km, IoU 0,65, erste Fläche 1983, 2022 2,43 Mio. km²; 20 a → 85 km, IoU 0,71, 1980, 2,50. Mit Fischerei (zweite Quelle gleichmäßig 20–50° N, 140° O…120° W, Stärke so gesetzt, dass sie 2015 80 % der Masse in der Fläche stellt): Mitte 177 km, IoU 0,66, erste Fläche 1979, Fläche 1990er 0,64 / 2020er 1,97 – also nicht besser und nicht ausgeliefert.
- **Einordnung:** Die Lage kommt vor allem aus der Konvergenz der Drifter-Klimatologie (Wirbel), nicht aus der Quellenverteilung; der gute Abgleich 2015 ist deshalb wenig überraschend und keine unabhängige Bestätigung. Das Wachstum davor/danach folgt allein aus der Produktionskurve, dem Abbau und der festen Schwelle; Jahr-zu-Jahr-Schwankungen sind Monte-Carlo-Rauschen (6.000 Partikel). Ohne Wind, Stokes-Drift, Jahreszeiten und Wirbel; Eintrag vor 1950 und nach 2022 fehlt.

### Andere Müllstrudel: Eriksen-Isolinien und Modell-Umrisse

Zusätzlich zum GPGP (Lebreton-Isolinien, `gpgp-model-outlines.geojson`) zeigt die Ebene `plastik` für die übrigen Wirbel:

- **Eriksen-Isolinien** (`gyre-contours.geojson`, Eriksen et al. 2014, CC BY 4.0, Zählung Teile/km², Stand ~2013; Stufen 10.000 / 30.000 / 100.000): dünne, hellblau gepunktete Linien, ab Zoom 1,5 sichtbar, Breite und Deckkraft von außen nach innen steigend; Beschriftung ab Zoom 3 („30.000 Teile/km² (Eriksen 2014)“). Für nordatlantik, suedatlantik, indik, suedpazifik, mittelmeer; Süd-Pazifik und Süd-Atlantik haben keinen Kern, Linien enden offen am Rand des Rasterausschnitts.
- **Modell-Umrisse** (`gyre-model-outlines.geojson`): gleiches gestricheltes Cyan wie beim GPGP, gefiltert nach dem Zeitreglerjahr (`gyreModelFilter`), nur nordatlantik, suedatlantik, indik. Leere Features werden nicht an die Karte gegeben, die Flächen (auch 0) liegen für die Panels bereit.
- **Panels** der Wirbel-Marker (und Klick auf einen Modell-Umriss): Eriksen-Fläche (≥ 30.000 Teile/km²), Modellfläche des gewählten Jahres bzw. Begründung („keine Fläche über der Schwelle – Modellgrenze“), Plausibilität gegen Eriksen (IoU, Mittelpunktabstand aus `gyre-model-meta.json`), Linienlegende pro Wirbel, Quellen.
- Der GPGP bekommt weder die Eriksen-Linien noch den Wirbelmodell-Umriss auf der Karte (sie widersprächen Lebreton); im Panel stehen nur Zahlen (Eriksen-Kern vs. Lebreton: ~400 km Versatz, IoU 0,47).

Grenzen: Süd-Pazifik und Mittelmeer haben im Modell nie eine Fläche (Flussmündungen speisen den Südpazifik kaum, das 0,5°-Feld löst das Mittelmeer nicht auf); der Süd-Atlantik ist im Modell zu groß und verschoben (IoU 0,18, ~1.670 km Versatz gegen Eriksen); Eriksen und Lebreton setzen den GPGP an leicht verschiedene Orte. Die Modell-Umrisse bleiben experimentell. Die Kopfzeile des Zeitstrahls zeigt weiter nur die GPGP-Modellfläche.

## Netzfänge weltweit

Ebene „Plastik im Meer“ zeigt neben den GPGP-Fängen (Lebreton, Masse g/km²) Netzfänge aus offenen Datensätzen für alle Meere (`scripts/tows-build.py` -> `data/plastik/tows-global.geojson`, ~680 KB, ~4.100 Fänge 2006–2024, Koordinaten auf 0,01° gerundet).
- Quellen: NOAA NCEI Marine Microplastics (CC0, nur Oberflächennetze, Einheit Teile/m³), Cózar 2015 (Mittelmeer, g/km²), Pedrotti 2016 (NW-Mittelmeer, Teile/km²), Leistenschneider 2023 (Weddellmeer, Teile/km²). Lizenz wird beim Download geprüft. SEA Law 2010/2014 sind zurückgestellt (IEDA: CC BY-NC-SA), Isobe 2021 ist ohne Bot-Abfrage nicht ladbar.
- Duplikate: Primärdaten schlagen NCEI; ein NCEI-Satz fällt weg, wenn ein Primärsatz innerhalb 0,05°, ±1 Tag (GPGP: gleiches Jahr) liegt und die Größenordnung passt (Eintauchtiefe n/c zwischen 1 cm und 3 m). Dazu GPGP-Fänge (Lebreton) und wiederholte Zeilen.
- Drei Größen, drei Skalen: Masse (Lila bis Gelb, wie das Dichtebild), Teile/km² (Blau bis Gelb, log10 10² bis 10⁶), Teile/m³ (Blau bis Gelb, log10 10⁻³ bis 10¹). Die Panel nennen die Größe und warnen vor dem Vergleich.
- Zeitregler: Jahre = Modelljahre ∪ Jahre beider Fanggruppen; Zähler „Netzfänge“ zählt beide. Zweite Kreisebene `plastik-tows-global` unter der GPGP-Ebene, gleiches Zeitverhalten (aktuelles Jahr kräftig, ältere blass).
- Offen: Isobe 2021 von Hand laden und einbinden; SEA-Daten, sobald die Lizenzfrage geklärt ist; Verlauf je Müllstrudel (`<patch>-history.json`).

## Phase 2 (später, eigener PR)

| Quelle | Idee | Weg |
|---|---|---|
| NOAA NCEI Marine Microplastics | `mikroplastik`-Ebene: ~14.000 Messpunkte 1972–heute, Zeitfilter (Zeitleiste wie bei Wahlen) | **D** Snapshot (vierteljährliche Updates), Task in `fetch-data.ts` oder orbis-data, Gruppe `manual`. Den neuen Cloud-Endpunkt erst ermitteln, die Seite migriert gerade |
| NOAA GDP Drifter (ERDDAP) | Echte Bojenbahnen | ✅ umgesetzt als Ebene `treibbojen`, siehe oben (statt weniger Dutzend: ~3.000 Bojen) |
| AOMI (Japan) | Mikroplastik-Raster als Alternative/Ergänzung zu Eriksen | erst Lizenz und Format prüfen |
| EMODnet Chemistry Litter | Strandmüll Europa | WMS → deklaratives `rasters` (wenn CORS/Kacheln passen) |
| NOAA Marine Debris Fotos / Commons | 1–3 gemeinfreie Bilder im GPGP-Steckbrief | Asset, Credit „NOAA“ |

## Bewusst weggelassen

TOC-Medien (keine freie Lizenz), Getty/AP/Reuters, OVI, SEAPLEX (nur YouTube), Biermann 2020 (Küste, nicht GPGP),
Plastic Litter Project (159 GB), HYCOM/OSCAR (Orbis hat schon Meeresströmung über Open-Meteo Marine), GGGI (Konto),
Litterbase (kein Download), Schmidt 2017 (nur ACS-Supplement), MDMAP/Debris Tracker/TIDES (Küstendaten, anderes Thema).
UNEP-INC und GPML erscheinen nur als Links in DATENQUELLEN.md.

### Gemeinsamer Zeitstrahl „Meeresplastik“

> ✅ Umgesetzt (Stand 2026-11-04, vom Nutzer noch nicht im Browser geprüft): `shared/meerzeit.ts` (Takt, Test daneben), `shared/treibhistorie.ts` (historisches Modell, Test daneben), `public/data/plastik/production.json` (aus `scripts/production-build.py`). Die drei Zeitstrahl-Modi `plastik`, `treibbojen`, `treibmodell` in `views/globe.ts` sind durch einen Modus `meer` ersetzt (Priorität unter `wahlen`, aktiv, sobald eine der drei Ebenen an und geladen ist).

- **Takt und Fokus (`meerzeit.ts`):** eine Kalenderachse **1950-01-01 bis zum letzten Datentag der Bojen** (2025-06-11; `setDriftReady` ruft `setMeerEnd`), Zeit in Tagen seit 1970-01-01 (wie die Bojendaten). Zustand: `time`, `playing` (Standard an, Start 1950), `speed` (1 / 3 / 10 s je Jahr, Standard 3 s) und der **Fokus** `focus`: `all` (Standard, der Takt treibt alle Ebenen) oder eine Ebene (`plastik`, `bojen`, `modell`). Nur die Ebenen, die getrieben werden (`meerDriven`: Fokus `all` oder diese Ebene), lesen `time`; die übrigen **halten** den Stand, den sie beim Wechsel hatten (`held`, gelesen mit `meerLayerTime`). Beim Verlassen von „Alle“ merkt sich der Takt die gemeinsame Zeit (`allTime`); „Alle“ springt alle Ebenen auf diese gemeinsame Zeit zurück. Die Achse hängt vom Fokus ab (`meerRange`): `all` und `modell` 1950 bis Datenende, `bojen` der Datenbereich der Bojen, `plastik` vom ersten bis zum letzten Jahr seines Schiebers (die Ebenen melden ihren Bereich mit `setMeerLayerRange`). Es gibt keine Kopplungsschalter mehr: ein Zustand je Modus (`focus`; Bojen-Modus und Modell-Modus in ihren `*time.ts`, beide fallen mit Fokus `all` auf Echte Zeit bzw. Historisch zurück). `tickMeer(dtMs)` ist rein (kein DOM): schiebt die Zeit, hält am Ende 2 s und beginnt am Anfang der Achse neu, läuft nie über ein **Tor** (`setMeerGate`) hinaus. Das Tor setzt das getriebene Modell auf den Tag, den es erreicht hat: rechnet es langsamer als die Uhr, **wartet die Uhr**. Getrieben wird der Takt von einer rAF-Schleife in `views/globe.ts` (nur solange abgespielt wird und die gezeigte Ansicht der Uhr folgt); die Ebenen lesen nur.
- **Plastik im Meer:** Jahr = Kalenderjahr der Zeit der Ebene (`meerLayerTime`), das letzte Jahr mit Daten davor (`yearAt`); vor dem ersten Jahr nichts, nach dem letzten bleibt das letzte. Im Fokus `plastik` ein eigener Schieber über die Jahre der Liste (Netzfang- und Modelljahre), Tempo: 1 Jahr = Tempo × 200 ms (Standard 3 s = 600 ms je Jahr wie vor dem Zusammenlegen). Der eigene Abspiel-Timer und `setPlastikStep` entfallen.
- **Treibbojen:** „Echte Zeit“ = Datum der Uhr (vor 1979 keine Bojen), im Fokus `bojen` mit Schieber über den Datenbereich (3000…Datenende); „Gemeinsamer Start“ gibt es nur im Fokus `bojen` (eigener Schieber 0…Schleifenlänge, eigene Schleife `tickDrift`, 5 s je Jahr); „Alle“ ist immer Echte Zeit. Hält die Ebene (anderer Fokus), steht sie. Die Ebene meldet die Zahl sichtbarer Bojen (`reportDriftActive`) für den Kopf.
- **Treibgut-Modell, neuer Modus „Historisch ab 1950“ (Standard, = gekoppelt):** leeres Meer am 1.1.1950; täglich treten Partikel an den Quellen ein (gewichtete Meijer-Mündungen wie bisher), Rate ∝ weltweiter Plastikproduktion des Kalenderjahres (`production.json`: Mt/Jahr, 1950–2019 OWID / Geyer et al. 2017, CC BY; 2020–2025 linear fortgeschrieben, Ausgleichsgerade 2015–2019 wie in `gpgp-model.py`); Abbau: jedes Partikel im Meer fällt mit Wahrscheinlichkeit 1 − exp(−1/(15·365)) je Tag aus (τ = 15 Jahre wie `gpgp-model.py`; die Zahl wird pro Tag einmal gezogen, die Partikel zufällig gewählt); dazu Stranden wie bisher; Obergrenze 8.000, das älteste Partikel weicht. **Freisetzungsmaß** `HIST_PER_DAY_REF` = 15 Partikel je Tag im Jahr 2020 (480 Mt), im Jahr 1950 (2 Mt) 0,06 je Tag. **Gemessen** (echtes Feld und echte Mündungen, Seed 1): Pool 1960 ≈ 73, 1970 ≈ 350, 1980 ≈ 920, 1990 ≈ 1.720, 2000 ≈ 3.120, 2010 ≈ 5.080, 2015 ≈ 6.230, **2020 ≈ 7.720**, ab 2022 an der Grenze (≈ 8.000); 1950–2022 wurden ≈ 125.000 Partikel freigesetzt, ≈ 106.000 gestrandet, ≈ 11.000 abgebaut. Rechenzeit in Node: 0,03 ms je Tag um 1960, 0,55 um 2000, 1,65–1,8 ab 2020 (Mittel 0,56 ms/Tag): 1950 → 2022 (26.300 Tage) ≈ 15 s reine Rechenzeit, im Browser bei 8 ms Budget je Frame (Sprung, Schieber, „Jetzt“) grob 30 s bis 1 min mit angezeigtem „Modell rechnet … 1987“. Beim Abspielen Budget 4 ms je Frame (≈ 240 ms Modellzeit je Sekunde): bis ≈ 2005 hält das Modell bei 3 s je Jahr mit, bei vollem Pool ≈ 2,6 s je Jahr; bei „1 Jahr = 1 s“ bremst das Modell die Uhr, bei 10 s nie.
- **Suchen und Prüfpunkte:** Das Modell läuft immer vorwärts. Alle 5 simulierten Jahre (`HIST_CHECK_DAYS`) wird eine Kopie von Partikelfeldern, Slot-Stapel und **Zufallszustand** abgelegt (`Checkpoints`, ≈ 150 KB je Prüfpunkt, 16 bis 2025). Ein Sprung zurück (Schieber, Schleife) stellt den nächsten früheren Prüfpunkt wieder her und rechnet bis zum Ziel; ein Sprung weit nach vorn nimmt einen späteren Prüfpunkt, wenn vorhanden. Das Ergebnis ist **bitgleich** wie ein Durchlauf ohne Sprung (getestet). Fester Seed 1: dasselbe Bild bei jedem Lauf. Das Modell läuft der Uhr bis zu 3 Tage voraus (`HIST_LEAD_DAYS`), damit die Uhr nicht stehen bleibt. Kopfzeile: sobald das Modell mehr als 5 Tage hinter der Uhr liegt, „Modell rechnet … <Jahr>“.
- **Modus „10 Jahre ab leerem Meer“ (`run`, wieder da seit 2026-11-04, vom Nutzer noch nicht im Browser geprüft):** dritter Modus in der Ansicht des Modells neben „Historisch ab 1950“ und „Live“ (`treibmodelltime.ts`: `mode = 'run'`, `target`, `seeks`; im Fokus „Alle“ fällt das Modell wie bei Live auf „Historisch“ zurück). Leeres Meer an Tag 0, konstant `RUN_PER_DAY` = 6 Partikel je Tag an den gewichteten Flussmündungen (21.900 je Lauf), gleiche Wirbelphysik, Pool 8.000 mit Auswurf des ältesten, gestrandete Partikel blenden aus und geben den Slot frei, kein Abbau (`restartRun` in `treibmodell.ts`). Eigener Schieber 0 bis 10 Jahre (`RUN_DAYS` = 3.650 Tage, Beschriftung „Jahr x von 10“). **Suchen:** eigene `Checkpoints(365)` (ein Prüfpunkt je simuliertem Jahr, inkl. Zufallszustand, u′/v′ und Slot-Stapel; Tag 0 wird beim Start gespeichert). Sprung zurück: nächster früherer Prüfpunkt, dann bis zum Ziel rechnen (Budget 8 ms je Frame, Kopfzeile „Modell rechnet … Jahr x von 10 (Ziel y)“); Sprung weit nach vorn nimmt einen späteren Prüfpunkt, sonst weiterrechnen. Gleicher Seed, daher **bitgleich** wie ein Lauf ohne Sprung (getestet in `treibhistorie.test.ts`). Abspielen mit dem Tempo des Zeitstrahls (1 Jahr = 1/3/10 s, Budget 2 ms je Frame: bei vollem Pool rechnet das Modell ≈ 1,7 ms je Tag, schnelle Tempi laufen dann langsamer als eingestellt). Am Ende hält das Bild 2 s (`HOLD_MS`), dann beginnt ein neuer Lauf mit dem nächsten Seed (kein exakter Wiederholer, Prüfpunkte verworfen). „Jetzt“ startet den Lauf neu (nächster Seed) und spielt. Kopfzeile „Jahr x von 10 · N im Meer · Y % gestrandet“.
- **Live** (nur im Fokus `modell`) ignoriert die Uhr und läuft endlos für sich, ohne Schieber, nur Zähler; Abspielen / Pause und „Jetzt“ (Neustart) gelten für diesen Lauf. Der 10-Jahres-Modus ist ersatzlos entfallen. Im Fokus `modell` mit „Historisch ab 1950“: eigener Schieber 1950 bis Datenende mit dem Suchen über die Prüfpunkte.
- **Oberfläche:** Über dem Zeitstrahl eine **Reiterzeile** (`.tl-tabs`): „Alle“ (Standard) und je eingeschalteter Plastikebene ein Reiter („Plastik im Meer“, „Treibbojen“, „Treibgut-Modell“); ist nur eine Ebene an, entfällt die Reiterzeile und der Zeitstrahl zeigt nur diese Ebene (Fokus automatisch). Hinter den Reitern stehen die Modusknöpfe der gewählten Ebene (Treibbojen: Echte Zeit | Gemeinsamer Start; Treibgut-Modell: Historisch ab 1950 | Live), nur in deren Ansicht. „Alle“: Kopf „Meeresplastik“ mit Datum / Jahr und je Ebene einem Kurzstatus (z. B. „1994 · Modell-Umriss 0,54 Mio. km² · Netzfänge 0 · Bojen 312 · Modell 4.120 im Meer“), danach die experimentellen Hinweise; eine Einzelansicht zeigt Titel, Datum und Status nur dieser Ebene. Ein Optionenknopf klappt unter dem Zeitstrahl **Tempo** (1 Jahr = 1 / 3 / 10 s) auf und gilt für die gezeigte Ansicht. Ohne Schieber nur das Live-Modell (Klasse `tl-notrack`); „Jetzt“ springt ans Ende der Achse der Ansicht (pausiert) bzw. startet den Lauf (Live, Gemeinsamer Start) neu. Die Wahl des Reiters (`meerChosen` in `views/globe.ts`) wird in den Fokus des Taktes übernommen (`syncMeerFocus`).

## Reihenfolge für die Umsetzung

1. ✅ `plastik-build.py --inspect`: Spalten der Rohdateien ansehen und hier im Plan nachtragen.
2. ✅ Build-Skript fertig bauen und `public/data/plastik/*` erzeugen. Größen prüfen: jedes PNG < 1 MB, jedes GeoJSON < 1,5 MB.
3. ✅ Ebene `plastik` mit globalem Bild, GPGP-Bild, Konturen, Strudel-Markern und GPGP-Steckbrief mit Diagramm.
4. ✅ Ebene `plastikfluesse`.
5. ✅ Ebene `plastikherkunft`.
6. ✅ DATENQUELLEN.md: neuer Abschnitt unter „5. Meer & Gewässer“ mit allen übernommenen Quellen, Lizenzen und DOIs.
   README-Feature-Zeile „🌊 Meeresplastik“.
7. `pnpm typecheck && pnpm test`. Danach prüft der Nutzer die Ebenen selbst im Browser.

## Vor dem Einbau zu prüfen

- Lizenz jeder figshare-Datei auf der Artikelseite selbst prüfen (`license` im API-JSON), nicht nur die Recherche übernehmen.
- Anteil Fischerei 75–86 % (Masse, Abstract Lebreton 2022) gegen das Paper prüfen. Das Lebreton-2018-Raster endet bei 200° O (−160°), der Patch reicht nach Westen darüber hinaus: Bild nicht als vollständige Patch-Fläche darstellen.
- Zahlen, die im Popup stehen, gegen das Paper prüfen. Das gilt besonders für Länderanteile 2022, „~100.000 t“ (TOC, unklar belegt)
  und das älteste datierte Objekt (1966).
- Eriksen-GeoTIFFs: Einheit und Größenklassen aus der Readme des Datensatzes übernehmen.
