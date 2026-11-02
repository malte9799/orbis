# Plan: geo3d als Standard-Renderer für alles 3D

Modelle, Linien, Bögen, Satelliten und Orbits werden nach Länge, Breite und Höhe platziert, bei jedem
Zoom und in jeder Projektion. Der Renderer kennt keine Zoom-Grenze mehr, Layer legen nur `minZoom` und
Detailstufen fest. Die eigenen 3D-Layer verschwinden. Stand: 2026-11-02.

## Stand

Der Spike ist vom Nutzer im Browser abgenommen, die Testszene ist danach wieder entfernt worden; getestet wird im
PR. Phase 1 bis 4 sind gebaut, Phase 4 im Browser aber noch nicht geprüft. Stage und Fokus laufen fest in
`views/globe.ts`; die Stage kommt erst mit ihrem ersten Objekt auf die Karte. Code: `src/globe/geo3d/`.

| Datei | Inhalt |
|---|---|
| `frame.ts` | `GeoFrame`: Platzieren, Bildschirmposition, Verdeckung durch den Globus, Überblendung |
| `stage.ts` | `GeoStage`: ein Custom Layer und ein Renderer pro Karte, eigener Framebuffer auf dem Globus, Picking, Cursor; `GeoPart`, `GeoTarget` |
| `line.ts` | `GeoLine`: Linie mit fester Pixelbreite, Strichelung und Ausblenden, auf Kugel und Karte |
| `wall.ts` | `GeoWall`: Vorhang von einer Linie zum Boden |
| `arc.ts` | `arcPoints`: Bogen entlang des Großkreises |
| `focus.ts` | `GeoFocus`: Kamera folgt einem Objekt, Drehen und Zoomen um das Objekt |
| `url.ts` | Fokus in der Adresse: `#/karte?follow=sat/iss&follow.t=…`; Slug und Zusatzwerte gibt die Quelle an |

Warum eigener Framebuffer: MapLibres Tiefenpuffer enthält auf dem Globus den Abstand zur Horizontebene
(`globeComputeClippingZ`), keine echte Tiefe. Labels danach lesen ihn weiterhin, also bleibt er unberührt.

## Phasen

| # | Inhalt | Fertig, wenn | Tage |
|---|---|---|---|
| ✓ 1 | `GeoStage` und `GeoFocus` fest in `views/globe.ts`, Kamerabefehle und Klick im Fokus | Karte ohne 3D-Objekt unverändert | gebaut |
| ✓ 2 | Geldflüsse als echte Bögen | Bögen in beiden Projektionen, Klicks gehen | gebaut |
| ✓ 3 | Flugzeuge migriert (`planes3d.ts`, `airport3d.ts`), `globeShown()` entfernt; ausgewähltes Flugzeug auf dem Globus, „Folgen“ über `GeoFocus` | Spur und Route auf dem Globus, flache Karte unverändert | gebaut |
| ✓ 4 | Schiffe, Fahrzeuge, `camview3d` migriert, `GLOBE_FLAT_ZOOM` entfernt, Folgen für Schiffe und Sonden über `GeoFocus` | keine Mercator-Rechnung mehr in Layern (`planetmap.ts` ausgenommen) | gebaut |
| 5 | Satelliten: `GeoPoints`, `GeoOrbit`, ISS-Modell | Starlink flüssig, Orbit beim Anklicken | 2–3 |
| 6 | Weltweite Flugzeuge mit Instancing und Detailstufen (`air.ts:64` befüllt heute nur die 2D-Quelle), Doku in `NEUER-LAYER.md` | flüssig bei Zoom 2 mit vollem Weltdatensatz | 2 |

Nach Phase 4 entscheiden: Patch `patches/maplibre-gl@6.14.0.patch` entfernen (Übergang wieder bei Zoom
11–12)? Der neue Renderer braucht ihn nicht mehr. `SurfaceModels` in `planetmap.ts` kann später folgen.

## Anforderungen aus den Tests

**Klick auf bestehende Objekte im Fokus (gebaut):** Ein Klick reicht: Der Fokus endet und das Objekt wird
ausgewählt. Trifft er nichts, endet nur der Fokus, ohne Wetter-Tooltip.

**Andere Kamerabefehle im Fokus (gebaut):** Zoom-Knöpfe, Neigungsregler und Kompass steuern den Fokus. Verschiebt
etwas anderes die Kartenmitte (Ortssuche, Panels), lässt der Fokus los. „Folgen“ im Flug-Panel läuft über den Fokus
(`follow=plane/<hex>`). Schiffe (`follow=ship/<mmsi>`), Sonden (`follow=plane/sonde:<id>`), Züge und Busse (`follow=vehicle/<key>`, mit eigener Seitenleiste) ebenso. Offen: Cockpit-Ansicht
(`flightpanel.ts`) und Navigation (`routing/locator.ts`) führen die Kamera noch selbst. Am Ende gibt es nur noch einen Kamera-Führer.

**Gelände:** Flugzeuge rechnen mit der Geländehöhe (`queryTerrainElevation`), das gilt auch für den Fokus. Noch offen
ist der Lag bei eingeschaltetem 3D-Gelände:
Gelände wird in jedem Frame neu gezeichnet, und bewegte Objekte erzwingen Dauer-Neuzeichnen. Es ruckelt auch ohne
`?geo3d` etwas, Gelände kostet also schon selbst; mit `?geo3d` ist es stärker. Vor Phase 3 mit und ohne Stage
messen (Kamera stehend und bewegt). Die Stage drosselt bei stehender Kamera auf 15 fps. Das gilt jetzt für alle 3D-Objekte.

**`moveend` im Fokus (gebaut):** Bei bewegtem Ziel endet in jedem Frame eine Kamerabewegung. `views/globe.ts` und
`overlay.ts` filtern das über `geo3dFocus`. Der Wind bleibt deshalb ausgeblendet, sobald die Kamera im Fokus
bewegt wird, bis der Fokus endet.

**Keine Mitte-Verschiebung:** Panels verschieben die Kartenmitte nicht, sie liegen über der Karte. Der Fokus setzt
sein Objekt also in die echte Bildmitte, auch wenn ein Panel offen ist. Nur beim Auswählen zielen einzelne
Panels die Kamera einmalig neben sich (`campanel.ts`, `airport3d.ts`, `detailpanel.ts`).

**2D-Karte:** Eine manuelle Umschaltung zwischen 2D und 3D gibt es nicht (entfernt in `c7cfe317`). Flach wird die
Karte nur durch den Zoom. `GeoFrame` muss deshalb Globus, Überblendung und flach können, einen Stilwechsel nicht.

## Noch zu testen

Erst möglich, wenn es als PR auf GitHub läuft:

- **Safari und iPhone:** Größtes offenes Risiko. Der Framebuffer nutzt 16-Bit-Farben mit 4× MSAA, ohne Fallback.
- **Touch:** Drehen, Pinch, Wegtippen; danach normales Verschieben und Zwei-Finger-Neigung.
- **Speicher und fps auf schwachen Geräten:** Bei 2880×1800 rechnerisch rund 300 MB Grafikspeicher. Erste Stellschraube: 4× MSAA.

## Grenzen des Fokus

- GEO-Objekte: Die Kamera kommt nicht näher als etwa 640 km.
- Niedrige Orbits in hohen Breiten: Der Zoom kann in der Überblendung stoppen.
- Sehr nah am Pol kann MapLibre die Kartenmitte begrenzen, das Objekt rutscht dann aus der Mitte.
- Die Adresse enthält das Objekt, nicht Zoom, Neigung und Richtung.
