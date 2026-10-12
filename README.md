# Wetter-Globus 🌍

Wetter-App mit zwei Ansichten:

- **Vorhersage** – aktuelles Wetter, 48-Stunden-Diagramm, 14-Tage-Vorhersage, Wind, UV, Luftqualität,
  Pollen, Sonnenauf-/-untergang und amtliche Unwetterwarnungen (DWD für Deutschland, NWS für die USA).
  Ortssuche, eigener Standort und Favoriten.
- **Karte** – interaktive Wetterkarte nach dem Vorbild von zoom.earth: standardmäßig als 2D-Karte,
  per Schalter **2D / 3D** auch als Globus. Live-Ebenen, Vorhersage-Ebenen mit Zeitleiste (bis +5 Tage,
  abspielbar), animierte Windströmung, Isobaren und Naturereignisse. Der Wert unter dem Mauszeiger wird
  angezeigt, ein Klick zeigt das Wetter an dieser Stelle.

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
| Luftraum | Flugzeuge, Hubschrauber, Segelflieger, Ballone, Drohnen (live, ab Zoom 5) | adsb.lol, Ersatz airplanes.live |
| Luftraum | Wetterballons (Radiosonden) | SondeHub |
| Weltraum | Satelliten (ISS, Wetter-, GPS-, Galileo-Satelliten), Starlink, Bodenspur per Klick | CelesTrak + SGP4 im Browser |
| Verkehr | Schiffsrouten, Fährlinien | Global Shipping Lanes (CC BY 4.0), OSM |
| Infrastruktur | Seekabel mit Anlandepunkten, Internetknoten (IXPs) | TeleGeography, PeeringDB |
| Infrastruktur | Wind-, Solar-, Kern-, Kohle-, Gas-, Wasserkraftwerke u. a.; beim Zoomen einzelne Windräder | WRI Global Power Plant Database, OSM (Overpass) |

Nicht enthalten, weil es dafür keine kostenlose, frei nutzbare Quelle gibt: Live-Schiffspositionen (AIS)
und Blitzortung.

Optional (im Ebenen-Panel unter „Erweitert“):

- **OpenWeatherMap**-Key → zusätzliche hochauflösende Wetterkarten
- **NASA FIRMS** MAP_KEY → einzelne Feuer-Hotspots als anklickbare Punkte

Schlüssel werden nur im `localStorage` des Browsers gespeichert.

## Entwicklung

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Typecheck + Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
```

Technik: Vite, TypeScript (ohne Framework), [MapLibre GL JS 6](https://maplibre.org/) mit Globus-Projektion.
Die Modellfelder werden über ein eigenes Kachel-Protokoll (`wxfield://`) im Browser gerendert,
der Wind wird als Partikelanimation auf einem Canvas über der Karte gezeichnet, Isobaren per Marching Squares.

## Deployment

`.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie auf
GitHub Pages (in den Repo-Einstellungen unter *Pages → Source* „GitHub Actions“ auswählen).

## Hinweise

- Die Vorhersage-Ebenen basieren auf einem globalen 10°-Raster (612 Punkte, alle 3 Stunden für 5 Tage).
  Beim Hineinzoomen wird automatisch ein feineres Raster (bis 0,25°) für den sichtbaren Ausschnitt geladen
  und nahtlos eingeblendet. Die Werte werden im Browser bilinear interpoliert.
- Die kostenlosen APIs haben Nutzungslimits (Open-Meteo: 10 000 Aufrufe/Tag für nicht-kommerzielle Nutzung,
  jeder Rasterpunkt zählt als Aufruf). Das globale Raster wird deshalb eine Stunde im Browser zwischengespeichert.
- Tornado-Daten gibt es nur für die USA – dort werden Tornados offiziell gewarnt und gemeldet.
- Einige Datensätze sind nur für nicht-kommerzielle Nutzung frei (u. a. TeleGeography-Seekabel, Esri-Satellitenbild,
  airplanes.live). Für eine kommerzielle Nutzung müssten diese ersetzt oder lizenziert werden.
- Die Rohdaten stammen von den jeweiligen Anbietern; für Warnungen gelten immer die amtlichen Stellen.
