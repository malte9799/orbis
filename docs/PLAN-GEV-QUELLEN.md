# Plan: Datenquellen aus „God's Eye View“ übernehmen

Abgleich der Quellen von [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)
(`DATA_SOURCES.md`, ~85 Live-Quellen + ~12 gebündelte Datensätze) mit [DATENQUELLEN.md](DATENQUELLEN.md),
und wie die fehlenden in Orbis eingebaut werden. Stand: 2026-10-26.

## Architektur-Unterschied

GEV hat einen eigenen Node-Server (`server/providers/*`), der jede Quelle abruft, cached und drosselt.
Orbis ist statisch (GitHub Pages) und hat dafür drei Wege – jede neue Quelle bekommt genau einen:

| Weg | Wann | Wo |
|---|---|---|
| **B** Browser direkt | Anbieter sendet CORS-Header | `src/api/*.ts` |
| **P** Daten-Proxy | kein CORS, aber live/ausschnittsbezogen nötig | Host + TTL in `HOSTS` von `proxy/cloudflare-worker.js`, Aufruf über `viaProxy()` |
| **D** `data`-Branch | kein CORS, global, ≥ 15 min alt ist ok, oder Schlüssel nötig, der nicht in den Browser soll | Task in `scripts/fetch-data.ts`, Secret in `.github/workflows/data.yml` |

Jede Ebene ist eine Datei `src/globe/layers/defs/<id>.ts` ([NEUER-LAYER.md](NEUER-LAYER.md)),
Kameras kommen als weitere Feeds in `src/api/cams.ts` / `camfeeds.ts`, Verkehrsmittel in `src/api/vehicles.ts`.
CORS-Angaben unten sind Erwartungen und müssen beim Einbau mit `curl -I -H 'Origin: …'` geprüft werden.

## Schon vorhanden (nichts zu tun)

OpenSky, adsb.lol (zivil), adsbdb (Route), aisstream.io, CelesTrak, Launch Library 2, USGS, NIFC WFIGS,
FIRMS, NASA GIBS (VIIRS), Esri World Imagery, OpenFreeMap, Mapterhorn-Gelände, Nominatim, Overpass,
Open-Meteo, Radio Browser, DeFlock/ALPR, Fintraffic-Kameras, Live Traffic NSW, DriveBC, Calgary, TfL,
NYC DOT, Caltrans, Ontario 511, Hong Kong, MBTA, TTC, Entur.

## Phase 1 – großer Nutzen, wenig Aufwand

| Quelle | Was | Weg | Umsetzung |
|---|---|---|---|
| ✅ adsb.lol `/v2/mil` | Militärflugzeuge weltweit | P | Filter/Hervorhebung in `aircraft.ts` + `shared/air.ts`; Flag `military` im Flugzeug-Panel |
| ✅ adsb.lol `/v2/point` (NIC/NACp) | **GNSS-Störungen** (GPS-Jamming): Flugzeuge mit schlechter Positionsintegrität, aggregiert auf Hex-Raster | P | neue Ebene `gnss.ts`; Raster clientseitig aus den ohnehin geladenen Flugzeugen bilden – kein zusätzlicher Abruf nötig, wenn `nic`/`nac_p` schon mitkommen |
| adsbdb `/v0/aircraft/{hex}` | Typ, Modell, Kennzeichen | P | in `route.ts` neben `callsign`; Drosselung wie GEV (max. 4 parallel, je Hex 1× pro Sitzung) |
| ✅ NOAA NHC Tropical-MapServer (ohne `CurrentStorms.json`) | Hurrikan-Positionen, Prognosepfade, Unsicherheitskegel (Atlantik/Pazifik) | B/P | Event-Feed `src/globe/events/feeds/nhc.ts` + Ebene `cyclones.ts` (Kegel als Fläche); ergänzt GDACS |
| ✅ GBFS (Lyft, BCycle, PBSC/Bicing/BiciMAD/Bike Itaú, nextbike, Urban Sharing, JCDecaux, Entur) | **Leihrad-Stationen** mit Verfügbarkeit | B (meist CORS) / P | neue Ebene `bikeshare.ts` ab Stadtzoom; Feed-Liste als Daten (`gbfs.json`: Name, `gbfs.json`-URL, bbox); nur Feeds im Ausschnitt laden; Header `Client-Identifier` / `ET-Client-Name` wo verlangt → dann P |
| GTFS-RT: HSL, OVapi (NL), TransLink SEQ, Metro Transit, CapMetro | weitere Live-Fahrzeuge | B/P | Einträge in `vehicles.ts` (GTFS-RT-Dekoder existiert schon für Malaysia) |

## Phase 2 – neue Kameras

Alle keylos, alle als Feed in `cams.ts`. Kamerabilder ohne CORS laufen ohnehin als `<img>`, nur die Kataloge brauchen ggf. P oder D.

| Quelle | Gebiet | Katalog | Hinweis |
|---|---|---|---|
| ✅ WSDOT `data.wsdot.wa.gov` | Washington | D | |
| ✅ King County (ArcGIS) | King County WA | B | |
| TxDOT ITS | Texas | P | Bild kommt als Base64 in JSON → im Worker oder Client dekodieren |
| ✅ City of Austin Open Data | Austin | B (Socrata) | |
| ✅ Statens vegvesen | Norwegen | B | Standbilder + HLS; NLOD |
| Servei Català de Trànsit `cameres.xml` | Katalonien | D | GML parsen |
| Tarktee (DATEX2) + Tallinn ristmikud | Estland | D | Bild-URLs rotieren → alle 15 min erneuern |
| Freeway Bureau `CCTV.xml` | Taiwan | D | Open Government Data License |
| City of Toronto (RESCU) | Toronto | B | |
| ✅ DelDOT `videocamera.json` | Delaware, **Live-HLS** | B | HLS-Player (hls.js) eingebaut; Caltrans-Streams laufen jetzt ebenfalls im Popup |
| Stadt Warendorf | 1 Webcam | B | statische Konfiguration |
| Eismoinfo | Litauen | – | nicht Teil der offenen Daten → standardmäßig aus, wie bei GEV |
| FL511 | Florida | – | **nur persönliche Nutzung** → weglassen oder hinter Opt-in |

Zusätzlich übernehmenswert: GEVs `cctv_ground_heights` (3.445 Kamerahöhen) bringt Orbis nichts (nur für Google 3D Tiles);
die CC0-Kameramodell-Daten (`cctv-database.com`) können ins Kamera-Popup.

## Phase 3 – neue Ebenen mit mehr Aufwand

| Quelle | Was | Weg | Aufwand / Anmerkung |
|---|---|---|---|
| ✅ NOAA nowCOAST WMS (Blitzdichte, GOES-Wolken; Radar nicht nötig) | Lightning-Density (Amerika/Pazifik, 15 min), MRMS-Radar, GOES-Wolken | B (WMS-Raster) | rein deklarative `rasters`; **amtliche Blitzquelle als Ersatz, solange die Blitzortung-Erlaubnis aussteht** |
| ✅ ECCC MSC GeoMet `aqhi-*` (eigene Ebene) | Luftqualität-Messstationen Kanada | B | Punkte in `aq.ts` neben dem CAMS-Modell |
| NASA CMR + GIBS HLS S30/L30 | **aktuelle Sentinel-2/Landsat-Bilder** pro Tag | B | Ebene `recentimagery.ts` mit Datumswahl; CMR liefert, an welchen Tagen Kacheln existieren |
| Mapillary | Straßenfotos als Ebene (Abdeckungslinien + Viewer) | B, 🔑 Token schon vorhanden | Vektorkacheln + MapillaryJS im Seitenpanel; Code aus `streetguess.ts` wiederverwenden |
| Panoramax · KartaView | freie Straßenfotos | B/P | gleiches Panel wie Mapillary; Panoramax hat Vektorkacheln + STAC |
| OSRM (FOSSGIS) | Routen zwischen zwei Kartenpunkten | B | Nutzungsregeln beachten (max. 1 Anfrage/s, kein Massenabruf) |
| ✅ Photon (komoot) | Adress-/POI-Suche ergänzend zur Open-Meteo-Ortssuche | B | in `search.ts` als zweite Stufe |
| ✅ TomTom Traffic Flow | Live-Verkehrsfluss weltweit | B, 🔑 BYOK | Schlüssel `src/settings/keys/tomtom.ts`, Vektorkacheln direkt von MapLibre; Ebene `traffic.ts` + `shared/trafficsim.ts` (Fahrzeugpunkte auf Straßenlinien, Tempo/Dichte nach Lage) |
| GDELT DOC 2.0 | Nachrichten zum Ort im Klick-Panel | B/P | Google News RSS **nicht** übernehmen (Nutzungsbedingungen) |
| NOAA GFS / ECMWF Open Data | Windmodell-Alternative | D | GRIB2 dekodieren → im `data`-Branch als PNG-Vektorfeld ablegen; nur sinnvoll, wenn Open-Meteos 10 000/Tag-Limit drückt |
| GTFS-RT Ontario (MiWay, Hamilton, Durham, Guelph, Kingston, Barrie, YRT, Burlington) | Fahrzeuge | B/P | Fleißarbeit, je ein Eintrag in `vehicles.ts`; Lizenzen jeweils widerruflich, Attribution nötig |

## Phase 4 – gebündelte Datensätze (`scripts/` → `public/data` bzw. `data`-Branch)

| Datensatz | Lizenz | Umsetzung |
|---|---|---|
| ✅ Rechenzentren (OSM, ~5.000) | ODbL | eigener wöchentlicher Overpass-Auszug, zusammengeführt mit PeeringDB-Standorten; Ebene `datacenters.ts` |
| Staudämme (OSM/OpenInfraMap, ~700) | ODbL | Ebene `dams.ts` oder Teil von `water.ts` |
| Militärgelände (OSM via Overture, ~36.000 Namen) | ODbL | Flächen kommen aus den OpenFreeMap-Kacheln (`landuse=military`), Namen als Beschriftung |
| Natural Earth Regionen (Gebirge, Wüsten, Meere) | gemeinfrei | Beschriftungs-Ebene für den Globus |
| Yale Bright Star Catalogue + ESO-Milchstraße | gemeinfrei / CC BY 4.0 | Sternenhimmel hinter dem Globus |
| US-Counties, DataSF-Stadtteile | gemeinfrei | nur bei Bedarf (z. B. Warnungen nach County) |

## Bewusst nicht übernehmen

- **Google Photorealistic 3D Tiles / Street View / Places** – MapLibre kann keine 3D Tiles; Google-Inhalte dürfen nicht gecacht werden.
- **TeleGeography Seekabel** – CC BY-NC-SA, in Orbis bereits durch OSM ersetzt ([Archiv](archiv/telegeography-seekabel.md)).
- **Google News RSS**, **FL511**, **Eismoinfo** – Nutzungsbedingungen.
- **S2 Underground GhostMaps** – Lizenz der KMZ-Produkte ungeklärt, inhaltlich parteiisch; höchstens als Link.
- **OpenAI/Gemini-Sprachsteuerung, Lokale Empfänger (dump1090/AIS-catcher)** – keine Datenquellen im engeren Sinn; lokale Empfänger wären als späteres Extra machbar (Browser darf `http://localhost` abrufen).

## Reihenfolge & Aufwand (grob)

1. Phase 1 – je 0,5–1 Tag pro Zeile; GNSS-Ebene und Militärfilter zuerst, weil sie auf vorhandenen Flugdaten aufsetzen.
2. Phase 2 – ~2 h pro Kamera-Feed, HLS einmalig ~1 Tag.
3. Phase 3 – 0,5–2 Tage je Ebene; Straßenfotos und aktuelle Satellitenbilder sind die größten.
4. Phase 4 – je ~0,5 Tag (Skript + Ebene).

Bei jeder Quelle: Eintrag in [DATENQUELLEN.md](DATENQUELLEN.md) (Legende 🟢/🔑/🌐/📦/🚫), Attribution in der Ebenen-Definition,
neuer Proxy-Host in `HOSTS` mit TTL.
