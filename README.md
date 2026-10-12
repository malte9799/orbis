# Wetter-Globus 🌍

Wetter-App mit zwei Ansichten:

- **Vorhersage** – aktuelles Wetter, 48-Stunden-Diagramm, 14-Tage-Vorhersage, Wind, UV, Luftqualität,
  Pollen, Sonnenauf-/-untergang und amtliche Unwetterwarnungen (DWD für Deutschland, NWS für die USA).
  Ortssuche, eigener Standort und Favoriten.
- **Globus** – interaktiver 3D-Globus (ähnlich zoom.earth) mit Wetterebenen und Naturereignissen.
  Ein Klick auf den Globus zeigt das aktuelle Wetter an dieser Stelle.

## Ebenen auf dem Globus

| Bereich | Ebene | Quelle |
|---|---|---|
| Karte | Satellit, NASA-Tagesbild (VIIRS), Dunkel, Hell, Ortsnamen, Tag/Nacht-Grenze | Esri, NASA GIBS, CARTO/OSM |
| Wetter | Regenradar mit Zeitleiste (letzte 2 h) | RainViewer |
| Wetter | Temperatur, Bewölkung, Niederschlag, Luftdruck (globales Modellraster) | Open-Meteo |
| Wetter | Animierte Windströmung | Open-Meteo |
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
Die Modellfelder werden über ein eigenes Kachel-Protokoll (`wxfield://`) im Browser bilinear interpoliert,
der Wind wird als Partikelanimation auf einem Canvas über dem Globus gezeichnet.

## Deployment

`.github/workflows/deploy.yml` baut die App bei jedem Push auf `main` und veröffentlicht sie auf
GitHub Pages (in den Repo-Einstellungen unter *Pages → Source* „GitHub Actions“ auswählen).

## Hinweise

- Die kostenlosen APIs haben Nutzungslimits (Open-Meteo: 10 000 Aufrufe/Tag für nicht-kommerzielle Nutzung).
  Das globale Modellraster (612 Punkte) wird deshalb 45 Minuten im Browser zwischengespeichert.
- Tornado-Daten gibt es nur für die USA – dort werden Tornados offiziell gewarnt und gemeldet.
- Die Rohdaten stammen von den jeweiligen Anbietern; für Warnungen gelten immer die amtlichen Stellen.
