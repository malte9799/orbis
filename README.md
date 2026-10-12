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

| Bereich | Ebene | Quelle |
|---|---|---|
| Karte | Satellit, NASA-Tagesbild (VIIRS), Dunkel, Hell, Ortsnamen, Tag/Nacht-Grenze | Esri, NASA GIBS, CARTO/OSM |
| Live | Regenradar mit Zeitleiste (letzte 2 h) | RainViewer |
| Live | Satellit Infrarot (weltweites Wolkenbild) | EUMETSAT |
| Live | Niederschlag aus Satellitendaten (30 min) | NASA GPM IMERG |
| Vorhersage | Wind, Windböen, Temperatur, gefühlte Temperatur, Luftfeuchtigkeit, Taupunkt, Niederschlag, Bewölkung, Luftdruck, Schneehöhe, Gewitterenergie (CAPE) – mit Zeitleiste bis +5 Tage | Open-Meteo |
| Vorhersage | Animierte Windpartikel, Isobaren mit Hoch-/Tiefdruckzentren | Open-Meteo |
| Ereignisse | Waldbrände | NASA EONET, GDACS |
| Ereignisse | Feuer-Hotspots (Satellit) | NASA FIRMS (über GIBS, oder als Punkte mit eigenem Key) |
| Ereignisse | Stürme & tropische Wirbelstürme inkl. Zugbahn | NASA EONET, GDACS |
| Ereignisse | Tornados & Unwetterwarnungen (USA) | NOAA NWS, SPC Storm Reports |
| Ereignisse | Erdbeben (7 Tage, ab M 2,5) | USGS |
| Ereignisse | Vulkane, Fluten, Dürren, Erdrutsche, Eisberge, Staubstürme | NASA EONET, GDACS |
| Ereignisse | Unwetterwarnungen Deutschland | Deutscher Wetterdienst (WMS) |

Alle Quellen sind ohne API-Schlüssel nutzbar. Optional (im Ebenen-Panel unter „Erweitert“):

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
- Die Rohdaten stammen von den jeweiligen Anbietern; für Warnungen gelten immer die amtlichen Stellen.
