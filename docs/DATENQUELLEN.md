# 📚 Datenquellen & Links

Alle Daten, Dienste und Medien, die Orbis nutzt – nach Themen sortiert, mit Link, Verwendungszweck und
(soweit bekannt) Lizenz. Zurück zur [Startseite](../README.md).

**Legende:** 🟢 frei, ohne Anmeldung · 🔑 optional mit kostenlosem Schlüssel · 🌐 über den
[Daten-Proxy](../README.md#-deployment) (CORS/Drosselung) · 📦 als Snapshot im `data`-Branch ·
🚫 nur nicht-kommerzielle Nutzung

> Die Rohdaten stammen von den jeweiligen Anbietern. Für Warnungen gelten immer die amtlichen Stellen.
> Die Lizenzangaben sind eine Orientierung, keine Rechtsberatung – maßgeblich sind die Bedingungen der Anbieter.

## Inhalt

1. [Wetter & Vorhersage](#1-wetter--vorhersage)
2. [Radar & Satellit](#2-radar--satellit)
3. [Warnungen & Katastrophen](#3-warnungen--katastrophen)
4. [Erde & Umwelt](#4-erde--umwelt)
5. [Meer & Gewässer](#5-meer--gewässer)
6. [Luftraum & Raumfahrt (Erde)](#6-luftraum--raumfahrt-erde)
7. [Verkehr & Verkehrsnetze](#7-verkehr--verkehrsnetze)
8. [Kameras & Radio](#8-kameras--radio)
9. [Infrastruktur](#9-infrastruktur)
10. [Basiskarten, Gelände & Geokodierung](#10-basiskarten-gelände--geokodierung)
11. [Weltall: Daten, Karten & Texturen](#11-weltall-daten-karten--texturen)
12. [3D-Modelle](#12-3d-modelle)
13. [Software & Bibliotheken](#13-software--bibliotheken)
14. [Optionale Schlüssel](#14-optionale-schlüssel)

---

## 1. Wetter & Vorhersage

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) – [Forecast](https://open-meteo.com/en/docs) | Aktuelles Wetter, 48-h-Diagramm, 14-Tage-Vorhersage, Wind, UV, Sonnenzeiten; globales Modellraster (Wind, Böen, Temperatur, Feuchte, Niederschlag, Bewölkung, Luftdruck, Schnee, CAPE) für die Kartenebenen | 🟢 CC BY 4.0, 🚫 nicht-kommerziell, 10 000 Aufrufe/Tag |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | Luftqualität & Pollen (Copernicus CAMS) | 🟢 Pflichtsatz „Generated using Copernicus Atmosphere Monitoring Service information“ |
| [Copernicus Atmosphere Monitoring Service](https://atmosphere.copernicus.eu) | Datengrundlage für Luftqualität & Pollen | 🟢 |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Ortssuche | 🟢 |
| [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) | Ortsname zum **eigenen** Standort (Reverse-Geocoding) – laut Fair-Use-Regel nur für den Gerätestandort erlaubt | 🟢 |
| [Nominatim](https://nominatim.org) (OpenStreetMap) | Ortsname zu einem Kartenklick | 🟢 ODbL, max. 1 Anfrage/s |
| [Bright Sky](https://brightsky.dev) (Deutscher Wetterdienst) | Amtliche Unwetterwarnungen Deutschland | 🟢 |
| [Deutscher Wetterdienst (DWD)](https://www.dwd.de) | Warnungen, Datengrundlage von Bright Sky | 🟢 DWD-Nutzungsbedingungen |
| [NWS – api.weather.gov](https://www.weather.gov/documentation/services-web-api) | Unwetterwarnungen USA, Tornado-/Unwetterwarnungen auf der Karte | 🟢 gemeinfrei |
| [NOAA Storm Prediction Center](https://www.spc.noaa.gov/climo/reports/) | Tornado-Meldungen USA | 🟢 gemeinfrei |
| [OpenWeatherMap](https://openweathermap.org) | Zusätzliche hochauflösende Wetterkarten | 🔑 |

## 2. Radar & Satellit

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [RainViewer](https://www.rainviewer.com/api.html) | Regenradar weltweit (letzte 2 h) – seit 2026 auf Zoom 7 beschränkt; eigener RainViewer-kompatibler Server möglich, z. B. [LibreWXR](https://github.com/JoshuaKimsey/LibreWXR) | 🟢 🚫 |
| [DWD Radar](https://maps.dwd.de) | Radar Deutschland (5 min, 1 km) | 🟢 |
| [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu) (NOAA NEXRAD) | Regenradar-Mosaik USA | 🟢 |
| [Environment Canada – GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/) | Regenradar und Schneeradar Kanada (1 km) | 🟢 Open Government Licence |
| [Finnish Meteorological Institute](https://en.ilmatieteenlaitos.fi/open-data) | Regenradar Finnland (1 km, 5 min) und 24-h-Regensumme | 🟢 CC BY 4.0 |
| [NOAA MRMS (opengeo.ncep.noaa.gov)](https://www.nssl.noaa.gov/projects/mrms/) | Regenradar Alaska, Hawaii, Puerto Rico, Guam | 🟢 |
| [Japan Meteorological Agency](https://www.jma.go.jp/bosai/nowc/) | Niederschlagsradar Japan (5 min) und Nowcast (+60 min) | 🟢 |
| [DWD WMS](https://maps.dwd.de) | Radar-Nowcast Deutschland (WN-Produkt, 2 h) | 🟢 CC BY 4.0 |
| [DWD Open Data – RV-Komposit](https://opendata.dwd.de/weather/radar/composite/rv/) | Rohraster 1 km, 5 min, Analyse + 120 min Nowcast (HDF5); geprüfte Quellen siehe [RADAR-QUELLEN.md](RADAR-QUELLEN.md) | 🟢 CC BY 4.0 |
| [EUMETSAT View](https://view.eumetsat.int) | Satellitenbild Infrarot (Wolken) und Konvektions-RGB (Gewitter) – WMS; **expliziter `TIME`-Parameter nötig**, sonst rendert der Server je Tile einen anderen Scan und die Zoomstufen passen nicht zusammen (IR-Komposit: 3-stündlich, ~2 h Verarbeitungslatenz; Konvektions-RGB: 15 min, ~20 min) | 🟢 |
| [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) (über GIBS) | Niederschlag aus Satellitendaten | 🟢 |
| [NASA GIBS](https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs) | Tagesbild (VIIRS), Nachtlichter (Black Marble), Vegetation (NDVI), Bodentemperatur, Schneedecke, Aerosole, Chlorophyll, Meerestemperatur (GHRSST MUR), Meereis (AMSR2) | 🟢 |

## 3. Warnungen & Katastrophen

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [NINA / BBK](https://warnung.bund.de) | Bevölkerungswarnungen (MoWaS, KATWARN, BIWAPP, Hochwasser, Polizei) | 🟢 |
| [NASA EONET](https://eonet.gsfc.nasa.gov) | Naturereignisse: Waldbrände, Stürme, Vulkane, Fluten, Dürren, Eis | 🟢 |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | Feuer-Hotspots (Raster bzw. anklickbare Punkte) | 🔑 `FIRMS_MAP_KEY`, 📦 |
| [GDACS](https://www.gdacs.org) | Weltweite Katastrophenwarnungen (Zyklone, Fluten …) | 🟢 |
| [USGS Earthquake Hazards](https://earthquake.usgs.gov/earthquakes/feed/) | Erdbeben weltweit ab M 2,5 | 🟢 gemeinfrei |
| [EMSC / SeismicPortal](https://www.seismicportal.eu) · [EMSC](https://www.emsc-csem.org) | Erdbeben Europa ab M 1,5 | 🟢 |
| [NOAA Tsunami Warning Centers](https://www.tsunami.gov) | Tsunami-Meldungen (7 Tage) | 🟢 📦 |
| [NIFC WFIGS](https://data-nifc.opendata.arcgis.com) | Waldbrand-Flächen USA | 🟢 |
| [Smithsonian Global Volcanism Program](https://volcano.si.edu) | Alle ~1.300 Vulkane mit letztem Ausbruch | 🟢 📦 |
| [Blitzortung.org](https://www.blitzortung.org) | Blitze live, letzte 15 min weltweit (inoffizieller WebSocket) | ⚠️ nur privat/Unterhaltung, nicht für Warnungen; Rohdaten nur mit Erlaubnis des Betreibers – Erlaubnis ausstehend |
| [BfS ODL-Messnetz](https://odlinfo.bfs.de) | Radioaktivität (Ortsdosisleistung) Deutschland | 🟢 DL-DE 2.0 |
| [EURDEP](https://remap.jrc.ec.europa.eu) (JRC) | Radioaktivität: ~3.500 Sonden in über 40 Ländern (u. a. FR, TR, CA, RU, HK) | 🟢 |
| [Safecast](https://safecast.org) · [Karte](https://map.safecast.org) | Radioaktivität weltweit | 🟢 CC0, 📦 |

## 4. Erde & Umwelt

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [Macrostrat](https://macrostrat.org) | Geologie (beim Zoomen immer genauer) | 🟢 |
| [Bird (2003) PB2002](https://doi.org/10.1029/2001GC000252) | Tektonische Plattengrenzen | 🟢 |
| [Wikidata](https://www.wikidata.org) / [Query Service](https://query.wikidata.org) | Rohstoffvorkommen weltweit (grob) | 🟢 CC0 |
| [USGS MRDS](https://mrdata.usgs.gov/mrds/) | Rohstoffvorkommen (regional) | 🟢 gemeinfrei |
| [BGR KOR250](https://services.bgr.de) | Rohstoffvorkommen Deutschland | 🟢 |
| [OpenStreetMap](https://www.openstreetmap.org) | Einzelne Bergwerke/Bohrlöcher, Pipelines, Windräder u. v. m. | 🟢 ODbL |
| [ESA WorldCover](https://esa-worldcover.org) (via [Terrascope](https://services.terrascope.be)) | Landbedeckung 10 m | 🟢 CC BY 4.0 |
| [NOAA SWPC](https://www.swpc.noaa.gov) · [Dienste](https://services.swpc.noaa.gov) | Polarlicht-Vorhersage (OVATION), Kp-Index, Sonnenwind, Bz, GOES-Röntgenklasse | 🟢 gemeinfrei |

## 5. Meer & Gewässer

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) | Seegang (Wellenhöhe, Dünung), Meeresströmung | 🟢 CC BY 4.0, 🚫 |
| [GloFAS via Open-Meteo Flood](https://open-meteo.com/en/docs/flood-api) | Flussabfluss mit 7-Tage-Trend | 🟢 CC BY 4.0, 🚫 |
| [PEGELONLINE (WSV)](https://www.pegelonline.wsv.de) | Pegelstände & Hochwasser an Bundeswasserstraßen | 🟢 |
| [NOAA NDBC](https://www.ndbc.noaa.gov) | Messbojen: Wellen, Wind, Luftdruck, Wassertemperatur | 🟢 🌐 |
| [NOAA CO-OPS Tides & Currents](https://tidesandcurrents.noaa.gov) | Gezeitenpegel USA mit Hoch-/Niedrigwasser | 🟢 🌐 |
| [GEBCO](https://www.gebco.net) | Meerestiefe weltweit | 🟢 – nicht zur Navigation |
| [EMODnet Bathymetry](https://emodnet.ec.europa.eu) | Meerestiefe Europa (detaillierter) | 🟢 CC BY 4.0 |
| [Global Shipping Lanes](https://github.com/newzealandpaul/Shipping-Lanes) | Schiffsrouten | 🟢 CC BY 4.0 |

## 6. Luftraum & Raumfahrt (Erde)

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [adsb.lol](https://adsb.lol) | Flugzeuge live (ab Zoom 5), 1. Wahl; Militärflugzeuge weltweit (`/v2/mil`, auch in der Weltübersicht, Filter „Nur Militär“); GPS-Störungen aus der gemeldeten Navigationsgenauigkeit (NIC/NACp, `gpsOkBefore`) – Zellen-Methode nach [gpsjam.org](https://gpsjam.org), Schwellen nach God's Eye View | 🟢 ODbL, 🌐 |
| [adsb.fi](https://adsb.fi) · [OpenData](https://opendata.adsb.fi) | Flugzeuge live, Rückfall | 🟢 🌐 |
| [OpenSky Network](https://opensky-network.org) | Flugzeuge (Weltübersicht alle 2 min), Flughafen-Abflüge/-Ankünfte vom Vortag | 🟢 🌐 |
| [adsbdb](https://www.adsbdb.com) | Route (Start-/Zielflughafen) des gewählten Flugzeugs nach Callsign: gestrichelte Prognoselinie und Seitenleiste; Community-Daten, kein Flugplan | 🟢 🌐 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) (Overpass) | Flughafen 3D (ab Zoom 11): Start- und Landebahnen, Rollwege, Vorfelder, Gates, Befeuerung (Gebäude liefert die Grundkarte) (`aeroway=*`); große Flughäfen liegen vorab erzeugt in `public/data/airports/` (`scripts/airports.ts`), alle anderen kommen live von Overpass; die Flugzeuge dazu kommen von den ADS-B-Quellen oben | 🟢 ODbL, 🌐, 📦 |
| [SondeHub](https://sondehub.org) | Wetterballons (Radiosonden): Position, Höhe, Steigrate, Frequenz, Bodenempfänger; als 3D-Ballonmodell im Flugverkehr (Klick → Detailpanel) und als 2D-Symbole | 🟢 |
| [The Space Devs – Launch Library 2](https://thespacedevs.com) | Raketenstarts mit Countdown & Livestream-Link | 🟢 |
| [CelesTrak](https://celestrak.org) + [satellite.js](https://github.com/shashwatak/satellite-js) (SGP4) | Satelliten (ISS, Wetter-, GPS-, Galileo-Satelliten, Starlink), Bodenspur | 🟢 |

## 7. Verkehr & Verkehrsnetze

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [Fintraffic Digitraffic](https://www.digitraffic.fi) ([Meri](https://meri.digitraffic.fi), [Rata](https://rata.digitraffic.fi)) | Schiffe live (AIS, Ostsee), Züge Finnland, Straßenwetter-Kameras | 🟢 CC BY 4.0 |
| [aisstream.io](https://aisstream.io) | Schiffe live weltweit | 🔑 |
| [NGA World Port Index](https://msi.nga.mil/Publications/WPI) (Pub. 150) | Häfen: ~3.800 Häfen mit Größe, Tiefen, Schiffsgrenzen und Umschlag; Werk der US-Regierung (NGA), kein Urheberrecht beansprucht; vorab erzeugt in `public/data/ports.json` (`scripts/ports.mjs`) | 🟢 gemeinfrei, 📦 |
| [Upply Seaports Locations Data](https://opendata.upply.com/seaports) (UN/LOCODE) | Häfen: ~12.000 weitere Seehäfen mit Koordinaten, die der World Port Index nicht führt | 🟢 CC BY 4.0, 📦 |
| [Transitous (MOTIS)](https://transitous.org) | Züge Deutschland & Europa; Busse, Trams, U-Bahnen (ab Stadtzoom) | 🟢 |
| [Amtraker](https://amtraker.com) | Züge USA (Amtrak) | 🟢 |
| [Entur](https://developer.entur.org) | Nahverkehr & Bahn Norwegen | 🟢 NLOD |
| [MBTA](https://api-v3.mbta.com) | Boston | 🟢 |
| [SEPTA](https://www3.septa.org) | Philadelphia | 🟢 |
| [TTC via umoiq](https://retro.umoiq.com) | Toronto | 🟢 |
| [data.gov.my – GTFS-Realtime](https://api.data.gov.my) | Malaysia | 🟢 |
| [Transport Victoria](https://opendata.transport.vic.gov.au) | Melbourne/Victoria | 🔑 |
| [CTA Train Tracker](https://www.transitchicago.com/developers/) | Chicago „L“ | 🔑 |
| [Trafiklab](https://www.trafiklab.se) | Schweden | 🔑 |
| [Autobahn GmbH – Verkehrslage](https://verkehr.autobahn.de) | Staus, Sperrungen, Baustellen, Autobahn-Webcams | 🟢 |
| [OpenStreetMap (Overpass)](https://wiki.openstreetmap.org/wiki/DE:Tag:highway%3Dspeed_camera) (`highway=speed_camera`, `type=enforcement`) | Blitzer & Rotlicht: ortsfeste Messstellen, Strecken-Abschnitte und Ampelkameras im Kartenausschnitt (ab Zoom 9) – Lageplan aus der Community, keine Fahrwarnung (in DE Nutzung während der Fahrt verboten, § 23 StVO) | 🟢 ODbL, 🌐 |
| [MapAtlas Camera Index](https://mapatlas.eu/camera-index) | Alternative Blitzer-Übersicht (Treiber-Meldungen, 106 Länder, CC BY 4.0) – Vorauswahl für eine spätere Zoom-Übersicht | 🟢 CC BY 4.0 |
| [OpenFreeMap](https://openfreemap.org) / OSM | Straßennetz mit Straßennummern | 🟢 ODbL |
| [OpenRailwayMap](https://www.openrailwaymap.org) | Bahnnetz, Streckengeschwindigkeit, Elektrifizierung | 🟢 |
| [OpenStreetMap Overpass](https://overpass-api.de) (+ [private.coffee](https://overpass.private.coffee)) | Bus-, Tram-, U-Bahn- und Fährlinien mit Haltestellen (ab Zoom 11) | 🟢 🌐 |
| [Waymarked Trails](https://waymarkedtrails.org) ([Rad](https://cycling.waymarkedtrails.org), [Wandern](https://hiking.waymarkedtrails.org)) | Radnetz, Wandernetz | 🟢 |

## 8. Kameras & Radio

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [Fintraffic Wettercams](https://weathercam.digitraffic.fi) | Webcams Finnland | 🟢 CC BY 4.0 |
| [Vegagerðin](https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur/vefmyndavelar) | Straßen-/Wetterkameras Island (~500 Aufnahmen) | 🟢 NLOD |
| [NZTA / trafficnz.info](https://www.nzta.govt.nz/traffic-and-travel-information/use-our-data) | Verkehrskameras Neuseeland (REST v4) | 🟢 |
| [TfNSW Live Traffic](https://opendata.transport.nsw.gov.au) | Verkehrskameras New South Wales | 🟢 CC BY 4.0 |
| [DriveBC](https://www.drivebc.ca) | Winter- und Verkehrskameras British Columbia | 🟢 Open Government Licence – BC |
| [City of Calgary](https://data.calgary.ca/stories/s/traffic-cameras/6hwp-pnmi) | Verkehrskameras Calgary | 🟢 |
| [Windy Webcams](https://api.windy.com/webcams) | Weltweite Webcams | 🔑 |
| [TfL](https://api.tfl.gov.uk) | London (inkl. Videoclips) | 🟢 |
| [NYC DOT](https://webcams.nyctmc.org) | New York | 🟢 |
| [DDOT / DC GIS](https://maps2.dcgis.dc.gov) | Washington D.C. | 🟢 |
| [Caltrans](https://cwwp2.dot.ca.gov) | Kalifornien – rund 2.200 Kameras mit Livestream (HLS) im Popup | 🟢 |
| [DelDOT](https://deldot.gov) ([Kameraliste](https://tmc.deldot.gov/json/videocamera.json)) | Delaware – rund 360 Kameras, alle als Livestream (HLS) | 🟢 |
| [Statens vegvesen](https://www.vegvesen.no) ([OGC-Kameraliste](https://ogckart-sn1.atlas.vegvesen.no/ogc/features/v1/collections/datex_3_1:CctvSimple)) | Norwegen – rund 860 Straßenkameras, davon ~140 als Livestream (HLS) | 🟢 NLOD |
| [ALERTCalifornia](https://cameras.alertcalifornia.org) (UC San Diego) | Waldbrandkameras Kalifornien | 🟢 |
| 511 ([Ontario](https://511on.ca/developers/doc), [Alberta](https://511.alberta.ca/developers/doc)) | Kameras Kanada | 🟢 🔑 kostenlos – My511-Konto anlegen, Key auf der Developers-Seite anfordern (10 Aufrufe/min) |
| [Hong Kong Transport Department](https://data.gov.hk) | Kameras Hongkong | 🟢 |
| [LTA / data.gov.sg](https://api.data.gov.sg) | Kameras Singapur | 🟢 |
| [NPS API](https://www.nps.gov/subjects/developer/) | Webcams US-Nationalparks | 🔑 `NPS_API_KEY`, 📦 |
| [DeFlock](https://deflock.org) · [deflock-data](https://github.com/flockhopper3/deflock-data) · [Tiles](https://tiles.dontgetflocked.com) | Kennzeichen-Kameras (ALPR) mit Blickrichtung | 🟢 OSM-basiert |
| [Radio Browser](https://www.radio-browser.info) | Über 50.000 Radiosender, eingebauter Player | 🟢 📦 |

## 9. Infrastruktur

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) (Overpass) | Unterseekabel (Telekommunikation) – weniger vollständig als kommerzielle Karten; frühere Quelle TeleGeography siehe [Archiv](archiv/telegeography-seekabel.md) | 🟢 ODbL, 📦 |
| [PeeringDB](https://www.peeringdb.com) | Internetknoten (IXPs) | 🟢 |
| [WRI Global Power Plant Database](https://datasets.wri.org/dataset/globalpowerplantdatabase) | Wind-, Solar-, Kern-, Kohle-, Gas-, Wasserkraftwerke | 🟢 CC BY 4.0 |
| OpenStreetMap (Overpass) | Einzelne Windräder, Öl-/Gaspipelines | 🟢 ODbL |

## 10. Basiskarten, Gelände & Geokodierung

| Anbieter | Verwendung in Orbis | Zugang |
|---|---|---|
| [OpenFreeMap](https://openfreemap.org) / [OpenStreetMap](https://www.openstreetmap.org/copyright) | Vektorkarte (Dunkel/Hell), Ortsnamen auf Deutsch, Grenzen | 🟢 ODbL |
| [Esri World Imagery](https://server.arcgisonline.com) | Satellitenbild | ⚠️ Esri-Nutzungsbedingungen, eigentlich ArcGIS-Token nötig; Attribution „Powered by Esri“ |
| [EOX Sentinel-2 cloudless](https://s2maps.eu) | Wolkenloses Satellitenbild (Copernicus Sentinel-2) | 🟢 CC BY-NC-SA 4.0, 🚫 |
| [OpenTopoMap](https://opentopomap.org) | Topografie | 🟢 CC BY-SA |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | Höhenmodell für die 3D-Geländeanpassung (USGS 3DEP, SRTM, GMTED, ETOPO1) – wird nicht als sichtbare Ebene angezeigt | 🟢 |
| [MapLibre GL JS](https://maplibre.org) | Kartendarstellung (2D & Globus) | 🟢 BSD-3 |

## 11. Weltall: Daten, Karten & Texturen

### Bahnen & Positionen

| Quelle | Verwendung | Zugang |
|---|---|---|
| [JPL – Approximate Positions of the Planets (Standish)](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Planetenpositionen (±wenige Bogenminuten, 1800–2050) | 🟢 |
| Astronomical Almanac | Mondposition (Näherung) | – |
| [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) | Bahnelemente der Asteroiden (Eros, Bennu, Itokawa, Kleopatra …) | 🟢 |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) / [SPICE](https://naif.jpl.nasa.gov/naif/) | Grundlage für die vereinfachten Raumsonden-Bahnen (`scripts/spacecraft-trajectories.mjs`) | 🟢 |
| [ESA SPICE-Daten](https://spiftp.esac.esa.int/data/SPICE/) | JUICE, BepiColombo (Modelle & Bahn) | © ESA |
| [CelesTrak](https://celestrak.org) | Erdsatelliten (TLE) | 🟢 |

### Texturen

| Quelle | Verwendung | Lizenz |
|---|---|---|
| [Solar System Scope](https://www.solarsystemscope.com/textures/) | Sonne, Planeten, Sternenhimmel | CC BY 4.0 |
| [USGS Astrogeology Science Center](https://astrogeology.usgs.gov/) | Monde, Pluto, Ceres, Vesta (Voyager, Galileo, Cassini, New Horizons, Dawn) | gemeinfrei |
| [NASA CGI Moon Kit (SVS 4720)](https://svs.gsfc.nasa.gov/4720) | Mond 4k/8k: LRO-Farbmosaik + LOLA-Höhenmodell (beim Deploy geladen) | gemeinfrei |

### Planeten-, Mond- & Kleinkörper-Karten (`#/planet?body=…`)

| Quelle | Verwendung |
|---|---|
| [NASA Trek-Portale](https://trek.nasa.gov) (Mars, Moon, Mercury, Venus, Titan, Enceladus, Io, Europa, Ganymede, Callisto, Phobos, Vesta, Ceres, Ryugu …) | Basiskarten aller Körper: Merkur (MESSENGER MDIS), Venus (Magellan), Mond (LRO-WAC), Mars (Viking, MOLA/HRSC, CTX, HiRISE), Titan, Phobos (Viking/MExLab), Io, Europa, Ganymede, Callisto (Galileo/Voyager), Mimas, Enceladus, Tethys, Dione, Rhea, Iapetus (Cassini/Voyager), Vesta & Ceres (Dawn), Ryugu (Hayabusa2) |
| [Cassini ISS DEM 375 m](https://trek.nasa.gov/enceladus/) | 3D-Relief der Enceladus-Karte (gestrecktes Graustufenbild, Meter angenähert) |
| Globale Höhenmodelle aus Trek (Magellan-Topographie, IoDEM, Phobos-DTM MExLab/HRSC, Vesta-DLR-DTM) | 3D-Relief der Venus-, Io-, Phobos- und Vesta-Karten; Listen per `scripts/trek-products.mjs` |

### Mond (Karte & Landestellen)

| Quelle | Verwendung |
|---|---|
| [NASA Moon Trek](https://trek.nasa.gov/moon/) | LRO-WAC-Mosaik (≈ 100 m/px), LROC-NAC-Mosaike der Landestellen, Kaguya, Geologie, Mineralien, LOLA-Relief; Produktliste per `scripts/moon-products.mjs` |
| [LRO / LROC](https://lroc.sese.asu.edu) | Kamerabilder des Mondes |
| [LOLA-Höhenmodell](https://trek.nasa.gov/moon/) (LRO_LOLA_DEM_Global_128ppd_v04) | 3D-Relief der Mondkarte im Globus (als gestrecktes Graustufenbild, Meter angenähert) |
| Regionale Höhenmodelle (Apollo-PanCam, LRO-NAC-DEM, polare LOLA-DEMs) | 3D-Relief der Landestellen beim Hineinzoomen; Liste per `scripts/moon-products.mjs` |
| Chang’e-2-Mosaik, Kaguya (JAXA), LOLA | feinere Mosaike im Modus „Automatisch“ |
| ~70 benannte Formationen | `src/space/moon-features.ts` (IAU-Nomenklatur) |

### Mars (Karte, Landestellen, Rover)

| Quelle | Verwendung |
|---|---|
| [NASA Mars Trek](https://trek.nasa.gov/mars/) | Farbmosaik, MOLA-Höhe, THEMIS-Infrarot, HRSC-Farbmosaike (ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO), HiRISE-Regionalmosaike (bis 25 cm/px), Geologie, Täler, Mineralien; Produktliste per `scripts/mars-products.mjs` |
| Regionale Höhenmodelle (HRSC-, CTX- und HiRISE-DEMs) | 3D-Relief beim Hineinzoomen (z. B. Gale, Columbia Hills, Victoria); Liste per `scripts/mars-products.mjs` |
| [CTX Global Mosaic](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer) (NASA/JPL/MSSS/Caltech Murray Lab via Esri) | 5-m-Basiskarte |
| [NASA MMGIS](https://mars.nasa.gov/maps/) | Fahrspuren von Perseverance & Curiosity, 72 Ingenuity-Flüge (`scripts/mars-traverse.mjs`, Rückfall `public/data/mars-traverse.json`) |
| [Landestellen-Steckbriefe](https://mars.nasa.gov/mars2020/) | Viking, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance, Zhurong |

### Raumsonden & Wikipedia

| Quelle | Verwendung |
|---|---|
| [NASA Missionsseiten](https://science.nasa.gov/missions/) · [ESA](https://www.esa.int) | Steckbriefe der Raumsonden (Voyager 1/2, New Horizons, Pioneer 10/11, Parker, JWST, SOHO, Juno, Europa Clipper, JUICE, BepiColombo …) |
| [Wikipedia (de)](https://de.wikipedia.org) | Weiterführende Suche im Steckbrief |

## 12. 3D-Modelle

| Quelle | Verwendung | Lizenz |
|---|---|---|
| [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | JWST, Hubble, ISS (≈ 96 MB, beim Deploy geladen), Voyager, Pioneer, Parker, Juno, Perseverance/Curiosity, LRO, Asteroiden (Eros, Bennu, Itokawa, Kleopatra …) | frei verwendbar |
| ESA (Cosmographia-Modelle aus den [SPICE-Daten](https://spiftp.esac.esa.int/data/SPICE/)) | JUICE, BepiColombo | © ESA – Lizenz für Weitergabe ungeklärt |
| Prozedural (`src/space/surface-models.ts`) | Lander, Flaggen, Fahrzeuge an Mond- und Mars-Landestellen | eigener Code |
| [Draco](https://google.github.io/draco/) | Kompression der GLB-Modelle (`public/draco`) | Apache-2.0 (Lizenztext in `public/draco/LICENSE`) |

## 13. Software & Bibliotheken

| Projekt | Zweck |
|---|---|
| [Vite](https://vite.dev) · [TypeScript](https://www.typescriptlang.org) | Build & Sprache |
| [MapLibre GL JS 6](https://maplibre.org) | 2D-Karte & Globus |
| [three.js](https://threejs.org) | 3D-Sonnensystem |
| [satellite.js](https://github.com/shashwatak/satellite-js) | SGP4-Bahnberechnung |
| [hls.js](https://github.com/video-dev/hls.js) | Live-Videos der Webcams (HLS) außerhalb von Safari |
| [GitHub Pages](https://pages.github.com) · [GitHub Actions](https://github.com/features/actions) | Hosting & Deploy |
| [Cloudflare Workers](https://workers.cloudflare.com) | optionaler Daten-Proxy |

## 14. Optionale Schlüssel

Alle kostenlos; werden nur im `localStorage` des Browsers gespeichert (außer den Action-Secrets).

| Schlüssel | Wofür | Anmeldung |
|---|---|---|
| OpenWeatherMap | zusätzliche Wetterkarten | [openweathermap.org/api](https://openweathermap.org/api) |
| NASA FIRMS `MAP_KEY` | anklickbare Feuer-Hotspots | [firms.modaps.eosdis.nasa.gov/api](https://firms.modaps.eosdis.nasa.gov/api/map_key/) |
| aisstream.io | Schiffe weltweit | [aisstream.io](https://aisstream.io) |
| Windy Webcams | weltweite Webcams | [api.windy.com](https://api.windy.com/webcams) |
| NPS API | Nationalpark-Webcams | [nps.gov/developer](https://www.nps.gov/subjects/developer/get-started.htm) |
| Transport Victoria · CTA · Trafiklab | Fahrzeuge Melbourne · Chicago · Schweden | siehe Tabelle Verkehr |
