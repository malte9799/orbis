# Orbis 🪐

**Wetter · Erde · All** – vom Wetter vor der Haustür über die Live-Weltkarte bis ins Sonnensystem,
in einer App und nahtlos per Zoom verbunden.

Drei Ansichten:

- **Vorhersage** – aktuelles Wetter, 48-Stunden-Diagramm, 14-Tage-Vorhersage, Wind, UV, Luftqualität,
  Pollen, Sonnenauf-/-untergang und amtliche Unwetterwarnungen (DWD für Deutschland, NWS für die USA).
  Ortssuche, eigener Standort und Favoriten.
- **Karte** – interaktive Wetterkarte nach dem Vorbild von zoom.earth: standardmäßig als 2D-Karte,
  per Schalter **2D / 3D** auch als Globus. Live-Ebenen, Vorhersage-Ebenen mit Zeitleiste (bis +5 Tage,
  abspielbar), animierte Windströmung, Isobaren und Naturereignisse. Der Wert unter dem Mauszeiger wird
  angezeigt, ein Klick zeigt das Wetter an dieser Stelle.

- **Weltall** – 3D-Sonnensystem (ähnlich NASA „Eyes on the Solar System“). Wer im 3D-Globus weiter
  herauszoomt, landet automatisch hier; Hineinzoomen auf die Erde führt zurück zur Wetterkarte.
  - Sonne, alle Planeten, Pluto und wichtige Monde mit Texturen – Planeten anklicken zum Hinfliegen,
    drehbare Kugel mit Steckbrief, aktuellem Abstand zu Sonne und Erde und Lichtlaufzeit;
    für Mond und Mars Link zur NASA-Detailkarte (Trek)
  - Mond in hoher Auflösung: LRO-Farbmosaik (4k/8k) mit Relief aus dem LOLA-Höhenmodell
    ([NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720), wird beim Deploy geladen) und beim Heranzoomen
    nachgeladene Kacheln des LRO-WAC-Mosaiks (≈ 100 m/Pixel, [NASA Moon Trek](https://trek.nasa.gov/moon/)) –
    Zoom bis ≈ 20 km über die Oberfläche
  - Flaggen an allen Landestellen (Apollo 11–17, Luna, Surveyor, Chang’e, Chandrayaan-3, SLIM, Odysseus,
    Blue Ghost, Athena) mit Steckbrief; sie erscheinen erst ab dem Landedatum. Direktlink z. B.
    `#/weltall?focus=moon&site=apollo11`
  - Mars wie der Mond: Landestellen (Viking, Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight,
    Perseverance, Zhurong) mit Steckbrief, beim Heranzoomen nachgeladene Kacheln – Farbmosaik
    ([NASA Mars Trek](https://trek.nasa.gov/mars/)) und das 5-m-CTX-Mosaik (NASA/JPL/MSSS/Caltech Murray Lab, via Esri).
    Perseverance, Curiosity und Ingenuity stehen auf der Oberfläche (aufrecht, mit dem Planeten mitdrehend);
    ihre Fahrspuren und die 72 Ingenuity-Flüge aus den NASA-MMGIS-Daten sind auf dem Boden eingezeichnet
    und folgen der Zeitleiste (Sol, gefahrene Strecke im Steckbrief)
  - **Planetenkarte** (`#/planet?body=mars`) – bedient sich wie die Erdkarte (MapLibre): 2D-Karte oder 3D-Globus,
    Ziehen verschiebt die Karte, Zoom zum Mauszeiger, Ebenen-Panel, Kartentyp-Wechsler (Farbe, CTX 5 m, MOLA,
    THEMIS), Suche und Maßstab. Herauszoomen aus dem Globus bzw. das Weltall-Symbol führt ins Sonnensystem,
    Hineinzoomen auf den Mars (oder ein Klick auf Rover/Landestelle) von dort auf die Karte. Landestellen,
    Fahrspuren von Perseverance/Curiosity, die 72 Ingenuity-Flüge; die Rover erscheinen beim Heranzoomen als
    3D-Modell in Originalgröße. In der Weltall-Ansicht haben die Planeten nur ihre feste Textur, die Detailkacheln
    gibt es nur auf der Karte (`src/space/planets.ts`: `enabled` – derzeit Erde und Mars, Mond/Merkur/Venus vorbereitet).
    Die Quellen sind Äquirektangular-Kacheln und werden per `planet://`-Protokoll in Mercator-Kacheln umgerechnet.
    Fahrspuren: `scripts/mars-traverse.mjs` (Daten-Branch, Rückfall `public/data/mars-traverse.json`)
  - Zeitstrahl: Datum wählen, abspielen von Echtzeit bis 1 Jahr pro Sekunde (auch rückwärts)
  - Raumsonden: Voyager 1/2, New Horizons, Pioneer 10/11, Parker Solar Probe, James-Webb-Teleskop,
    SOHO, Juno, Perseverance, Curiosity, Europa Clipper, JUICE, BepiColombo – mit Flugbahnen
  - Erdsatelliten (ISS, Wetter-, GPS-, Galileo-Satelliten) in Erdnähe, berechnet aus CelesTrak-Bahndaten
  - 3D-Modelle der NASA ([NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), frei verwendbar) und der ESA für JUICE und BepiColombo (Cosmographia-Modelle aus den [ESA SPICE-Daten](https://spiftp.esac.esa.int/data/SPICE/), © ESA) für
    James-Webb-Teleskop, Hubble, ISS, Voyager, Pioneer, Parker Solar Probe, Juno, Perseverance/Curiosity und LRO.
    Sie werden erst geladen, wenn man ein Objekt anwählt oder nah genug heranzoomt; Die ISS wird zunächst klein, dann (beim Anwählen/Heranzoomen) als detailliertes NASA-Modell (≈ 96 MB, beim Deploy geladen) gezeigt; Große Modelle (Rover, JWST, Europa Clipper …) haben eine kleine Schnellvariante (`*-lite.glb`), die vom Original abgelöst wird; Hubble und ISS mit Live-Position

  Planetenpositionen stammen aus den JPL-Näherungsformeln (Standish, ±wenige Bogenminuten 1800–2050),
  der Mond aus der Näherung des Astronomical Almanac. Bahnen der Raumsonden sind vereinfacht und als
  „angenähert“ gekennzeichnet, da es keine kostenlose, browsertaugliche Bahndaten-API gibt.
  Texturen: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).

## Ebenen der Karte

Alle Quellen sind kostenlos und ohne Anmeldung nutzbar.

| Bereich | Ebene | Quelle |
|---|---|---|
| Karte | Dunkel/Hell (Vektorkarte), Ortsnamen auf Deutsch, Grenzen | [OpenFreeMap](https://openfreemap.org) / OpenStreetMap |
| Karte | Satellit, NASA-Tagesbild (VIIRS), Tag/Nacht-Grenze | Esri, NASA GIBS |
| Live | Regenradar weltweit (letzte 2 h) | RainViewer |
| Live | Radar Deutschland (5 min, 1 km) | Deutscher Wetterdienst |
| Live | Satellit Infrarot, Niederschlag aus Satellitendaten | EUMETSAT, NASA GPM IMERG |
| Vorhersage | Wind, Böen, Temperatur, gefühlte Temperatur, Luftfeuchte, Taupunkt, Niederschlag, Bewölkung, Luftdruck, Schneehöhe, CAPE – Zeitleiste bis +5 Tage, Windpartikel, Isobaren | Open-Meteo |
| Ereignisse | Waldbrände, Feuer-Hotspots, Stürme & Zyklone, Tornados (USA), Vulkane, Fluten, Dürren, Eis | NASA EONET/FIRMS, GDACS, NOAA |
| Ereignisse | Erdbeben – Europa ab M 1,5, weltweit ab M 2,5 | EMSC, USGS |
| Europa | Städtewetter (~190 Städte), Unwetterwarnungen DE (anklickbar) | Open-Meteo, DWD |
| Europa | Pegelstände & Hochwasser an Bundeswasserstraßen | PEGELONLINE (WSV) |
| Europa | Luftqualität & Pollen in europäischen Städten | Copernicus CAMS via Open-Meteo |
| Luftraum | Flugzeuge, Hubschrauber, Segelflieger, Ballone, Drohnen (live, ab Zoom 5) | adsb.lol, adsb.fi, airplanes.live, OpenSky Network (der Reihe nach, die erste erreichbare Quelle wird verwendet) |
| Erde & Umwelt | Rohstoffvorkommen (Öl, Gas, Kohle, Erze, Salz, Steine …) – weltweit grob, ab Zoom 7 regional, ab Zoom 10 einzelne Bergwerke/Bohrlöcher | Wikidata, USGS MRDS, BGR KOR250 (DE), OpenStreetMap |
| Erde & Umwelt | Geologie (beim Zoomen immer genauer), tektonische Plattengrenzen | Macrostrat, Bird (2003) PB2002 |
| Erde & Umwelt | Nachtlichter, Vegetation (NDVI), Bodentemperatur, Schneedecke, Aerosole | NASA GIBS (Black Marble, MODIS) |
| Erde & Umwelt | Landbedeckung 10 m | ESA WorldCover |
| Verkehr | Öl- & Gaspipelines (ab Zoom 8) | OpenStreetMap |
| Luftraum | Flugzeuge: Weltübersicht beim Herauszoomen (alle 2 min) | OpenSky Network |
| Erde & Umwelt | Polarlicht-Vorhersage mit Kp-Index | NOAA SWPC (OVATION) |
| Erde & Umwelt | Alle ~1.300 Vulkane mit letztem Ausbruch | Smithsonian Global Volcanism Program |
| Erde & Umwelt | Waldbrand-Flächen USA | NIFC WFIGS |
| Erde & Umwelt | Tsunami-Meldungen (7 Tage) | NOAA National/Pacific Tsunami Warning Center |
| Erde & Umwelt | Blitze live (letzte 15 min, weltweit) | Blitzortung.org (WebSocket, nicht-kommerziell) |
| Erde & Umwelt | Radioaktivität (Ortsdosisleistung) | BfS ODL-Messnetz (DE), EURDEP (~5.500 Sonden, 39 Länder), Safecast (weltweit, CC0) |
| Wetter | Meerestemperatur, Meereis | NASA GHRSST MUR, AMSR2 (GIBS) |
| Luftraum | Raketenstarts mit Countdown & Livestream-Link | The Space Devs Launch Library 2 |
| Luftraum | Flughäfen mit Abflügen/Ankünften vom Vortag | OpenFreeMap/OSM, OpenSky Network |
| Verkehr | Schiffe live (AIS) | Fintraffic Digitraffic (Ostsee), optional aisstream.io (weltweit, kostenloser Schlüssel) |
| Verkehr | Züge live: Deutschland & Europa (Position aus Echtzeitfahrplan), GPS in Finnland und USA | Transitous (MOTIS), Fintraffic Digitraffic, Amtraker |
| Verkehr | Busse, Trams & U-Bahnen live (ab Stadtzoom) | Transitous |
| Verkehr | Nahverkehr & Bahn per GPS: Norwegen, Boston, Philadelphia, Toronto, Malaysia | Entur, MBTA, SEPTA, TTC (umoiq), data.gov.my (GTFS-Realtime) |
| Verkehr | optional mit kostenlosem Schlüssel: Melbourne/Victoria, Chicago „L“, Schweden | Transport Victoria, CTA Train Tracker, Trafiklab |
| Verkehrsnetze | Straßennetz (Autobahn bis Kreisstraße, mit Straßennummern) | OpenFreeMap / OpenStreetMap |
| Verkehrsnetze | Bahnnetz, Streckengeschwindigkeit, Elektrifizierung | OpenRailwayMap |
| Verkehrsnetze | Bus-, Tram-, U-Bahn- und Fährlinien mit Haltestellen (ab Zoom 11) | OpenStreetMap (Overpass) |
| Verkehrsnetze | Radnetz, Wandernetz | Waymarked Trails |
| Verkehr | Autobahn: Staus, Sperrungen, Baustellen | Autobahn GmbH des Bundes |
| Europa | Bevölkerungswarnungen (MoWaS, KATWARN, BIWAPP, Hochwasser, Polizei) | NINA / BBK |
| Kameras | Live-Webcams (Bild im Popup) | Fintraffic Digitraffic (Finnland, CC BY 4.0), OpenStreetMap, optional Windy Webcams (kostenloser Schlüssel) |
| Kameras | Weitere Live-Webcams: London (mit Videoclips), New York, Washington D.C., Kalifornien (Caltrans, ALERTCalifornia-Waldbrandkameras), Ontario, Alberta, Hongkong, Singapur, Autobahn; optional US-Nationalparks | TfL, NYC DOT, DDOT, Caltrans, UC San Diego, 511, HK Transport Department, LTA, Autobahn GmbH, NPS |
| Radio | Über 50.000 Radiosender weltweit, direkt im eingebauten Player hörbar | Radio Browser |
| Kameras | Kennzeichen-Kameras (ALPR, u. a. Flock Safety) mit Blickrichtung | OpenStreetMap/DeFlock: Übersicht USA/Kanada aus [deflock-data](https://github.com/flockhopper3/deflock-data), ab Zoom 9 weltweit live per Overpass |
| Luftraum | Wetterballons (Radiosonden) | SondeHub |
| Weltraum | Satelliten (ISS, Wetter-, GPS-, Galileo-Satelliten), Starlink, Bodenspur per Klick | CelesTrak + SGP4 im Browser |
| Verkehr | Schiffsrouten, Fährlinien | Global Shipping Lanes (CC BY 4.0), OSM |
| Infrastruktur | Seekabel mit Anlandepunkten, Internetknoten (IXPs) | TeleGeography, PeeringDB |
| Infrastruktur | Wind-, Solar-, Kern-, Kohle-, Gas-, Wasserkraftwerke u. a.; beim Zoomen einzelne Windräder | WRI Global Power Plant Database, OSM (Overpass) |
| Meer | Seegang (Wellenhöhe, Dünung) und Meeresströmung im Kartenausschnitt | Open-Meteo Marine (CC BY 4.0, nicht-kommerziell) |
| Meer | Flussabfluss mit 7-Tage-Trend im Kartenausschnitt (Punkte auf den nächsten Fluss gerastet) | GloFAS via Open-Meteo Flood (CC BY 4.0, nicht-kommerziell) |
| Meer | Messbojen live (Wellen, Wind, Luftdruck, Wassertemperatur) | NOAA NDBC (über den Daten-Proxy) |
| Meer | Gezeitenpegel USA mit Wasserstand und nächsten Hoch-/Niedrigwassern | NOAA CO-OPS (über den Daten-Proxy) |
| Meer | Meerestiefe weltweit, Europa detaillierter | GEBCO, EMODnet Bathymetry (CC BY 4.0) – nicht zur Navigation |
| Meer | Chlorophyll (Algenblüte) | NASA VIIRS über GIBS |
| Radar | Regenradar USA (NEXRAD-Mosaik), Kanada (1 km) | NOAA via Iowa Environmental Mesonet, Environment Canada (Open Government Licence) |
| Gelände | 3D-Gelände mit Schummerung (Globus und 2D) | AWS Terrain Tiles (USGS 3DEP, SRTM, GMTED, ETOPO1) |
| Karte | Basiskarten Sentinel-2 (wolkenlos) und Topografie | EOX Sentinel-2 cloudless 2024 (CC BY-NC-SA 4.0, nur nicht-kommerziell), OpenTopoMap (CC-BY-SA) |
| Erde & Umwelt | Polarlicht-Ebene zeigt zusätzlich Sonnenwind, Bz und GOES-Röntgenklasse | NOAA SWPC |

Nicht enthalten, weil es dafür keine kostenlose, frei nutzbare Quelle gibt: Live-Schiffspositionen (AIS)
und Blitzortung.

Optional (im Ebenen-Panel unter „Erweitert“):

- **OpenWeatherMap**-Key → zusätzliche hochauflösende Wetterkarten
- **NASA FIRMS** MAP_KEY → einzelne Feuer-Hotspots als anklickbare Punkte

Der kostenlose RainViewer-Zugang ist seit 2026 auf Zoom 7 beschränkt. Unter „Erweitert“ kann ein eigener RainViewer-kompatibler Radar-Server (z. B. selbst gehostetes [LibreWXR](https://github.com/JoshuaKimsey/LibreWXR)) eingetragen werden.

Schlüssel werden nur im `localStorage` des Browsers gespeichert.

## Entwicklung

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Typecheck + Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
```

Technik: Vite, TypeScript (ohne Framework), [MapLibre GL JS 6](https://maplibre.org/) mit Globus-Projektion,
[three.js](https://threejs.org/) für das Sonnensystem (wird erst beim Öffnen geladen).
Die Modellfelder werden über ein eigenes Kachel-Protokoll (`wxfield://`) im Browser gerendert,
der Wind wird als Partikelanimation auf einem Canvas über der Karte gezeichnet, Isobaren per Marching Squares.

## Deployment

`.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie auf
GitHub Pages (in den Repo-Einstellungen unter *Pages → Source* „GitHub Actions“ auswählen).

### Daten-Proxy (Cloudflare Worker, empfohlen)

adsb.fi, airplanes.live und OpenSky erlauben keine Abrufe direkt aus dem Browser (CORS), adsb.lol
drosselt schnell, und die öffentlichen Overpass-Server (OpenStreetMap-Ebenen) lassen pro Nutzer nur
wenige Anfragen zu. `proxy/cloudflare-worker.js` löst das: Er ergänzt die CORS-Header und speichert
Antworten zwischen (Flugdaten ~8 s, Overpass 15 min), sodass viele Besucher am selben Ort nur eine
Anfrage auslösen. Auch NOAA NDBC (Messbojen) und NOAA CO-OPS (Gezeitenpegel) laufen über den Proxy; nach einem Update des Proxy-Codes muss der Worker neu deployt werden. Der kostenlose Cloudflare-Tarif erlaubt 100.000 Anfragen pro Tag.

Einrichten:

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) kostenlos registrieren.
2. *Compute (Workers) → Workers & Pages → Create → Worker* („Start with Hello World“), Namen
   vergeben (z. B. `orbis-proxy`) → *Deploy*.
3. *Edit code*: den Inhalt komplett durch `proxy/cloudflare-worker.js` ersetzen → *Deploy*.
   Die Adresse lautet dann `https://orbis-proxy.<dein-konto>.workers.dev/`.
4. Test im Browser: `https://orbis-proxy.<dein-konto>.workers.dev/?url=https%3A%2F%2Fapi.adsb.lol%2Fv2%2Fpoint%2F53.55%2F10%2F25`
   sollte JSON mit Flugzeugen zeigen.
5. Absichern (empfohlen): Worker → *Settings → Variables and Secrets → Add* → Typ *Text*,
   Name `ALLOWED_ORIGINS`, Wert `https://malte9799.github.io,http://localhost:5173` → *Deploy*.
   Dann können nur Orbis und die lokale Entwicklung dein Tageskontingent nutzen.
6. Fest in die App einbauen: im GitHub-Repo *Settings → Secrets and variables → Actions →
   Variables → New repository variable*, Name `PROXY_URL`, Wert = Worker-Adresse aus Schritt 3.
   Danach *Actions → Deploy to GitHub Pages → Run workflow* (oder beim nächsten Push auf `main`).

Alternativ kann jeder Nutzer eine eigene Worker-Adresse unter *Einstellungen → Daten-Proxy*
eintragen; sie hat Vorrang vor der eingebauten. Fällt der Proxy aus, greift die App wieder direkt
auf die Quellen zu.

### Daten-Snapshots (`data`-Branch)

Einige Quellen erlauben keine Abrufe direkt aus dem Browser (fehlende CORS-Header): Seekabel
(TeleGeography), Vulkane (Smithsonian), Tsunami-Meldungen (NOAA), Blitze (Blitzortung.org), Safecast, Radio Browser und
mehrere Webcam-Listen. `.github/workflows/data.yml` lädt sie deshalb serverseitig – live alle
15 Minuten, den Rest täglich – mit `scripts/fetch-data.ts` in den Branch `data`. Die App liest
sie über `raw.githubusercontent.com` und fällt sonst auf die Originalquelle zurück. Der erste
Lauf startet automatisch beim Push, danach per Zeitplan (oder manuell unter *Actions*).

**Schlüssel für alle Nutzer teilen (optional):** Dienste mit kostenlosem Schlüssel, deren Daten
sich als Datei abbilden lassen, kann die Action mit *deinem* Schlüssel abrufen – er liegt dann
nur als GitHub-Secret vor, nie im Browser, und alle Nutzer teilen sich das Ergebnis. Unterstützt:
`FIRMS_MAP_KEY` (weltweite, anklickbare Feuer-Hotspots) und `NPS_API_KEY` (Nationalpark-Webcams).
Secret anlegen unter *Settings → Secrets and variables → Actions*. Ohne Secret wird die Ebene
ohne Schlüssel bzw. mit dem alten Rasterbild angezeigt. Nicht für alle teilbar sind
ortsabhängige oder Dauerverbindungs-Dienste (OpenWeatherMap, aisstream, Windy, Fahrzeug-Feeds) –
die bleiben pro Nutzer unter *Einstellungen*.

## Hinweise

- Die Vorhersage-Ebenen basieren auf einem globalen Raster von 15° × 10° (408 Punkte, alle 3 Stunden für 5 Tage);
  Taupunkt und gefühlte Temperatur werden im Browser berechnet. Alle Open-Meteo-Abrufe laufen über eine Drossel,
  die unter dem Minutenlimit bleibt.
  Beim Hineinzoomen wird automatisch ein feineres Raster (bis 0,25°) für den sichtbaren Ausschnitt geladen
  und nahtlos eingeblendet. Die Werte werden im Browser bilinear interpoliert.
- Die kostenlosen APIs haben Nutzungslimits (Open-Meteo: 10 000 Aufrufe/Tag für nicht-kommerzielle Nutzung,
  jeder Rasterpunkt zählt als Aufruf). Das globale Raster wird deshalb eine Stunde im Browser zwischengespeichert.
- Tornado-Daten gibt es nur für die USA – dort werden Tornados offiziell gewarnt und gemeldet.
- Einige Datensätze sind nur für nicht-kommerzielle Nutzung frei (u. a. TeleGeography-Seekabel, Esri-Satellitenbild,
  airplanes.live). Für eine kommerzielle Nutzung müssten diese ersetzt oder lizenziert werden.
- Die Rohdaten stammen von den jeweiligen Anbietern; für Warnungen gelten immer die amtlichen Stellen.
