# Plan: geo3d als Standard-Renderer für alles 3D

Modelle, Linien, Bögen, Satelliten und Orbits werden nach Länge, Breite und Höhe platziert, bei jedem
Zoom und in jeder Projektion. Der Renderer kennt keine Zoom-Grenze mehr, Layer legen nur `minZoom` und
Detailstufen fest. Die eigenen 3D-Layer verschwinden. Stand: 2026-11-02.

## Stand

Der Spike ist fertig und vom Nutzer im Browser abgenommen, läuft aber nur als Testszene unter `?geo3d`
(Dev-Server, nicht im Produktions-Build). Code: `src/globe/geo3d/`.

| Datei | Inhalt |
|---|---|
| `frame.ts` | `GeoFrame`: Platzieren, Bildschirmposition, Verdeckung durch den Globus, Überblendung |
| `stage.ts` | `GeoStage`: ein Custom Layer und ein Renderer pro Karte, eigener Framebuffer auf dem Globus, Picking, Cursor; `GeoPart`, `GeoTarget` |
| `line.ts` | `GeoLine`: Linie mit fester Pixelbreite, auf Kugel und Karte |
| `focus.ts` | `GeoFocus`: Kamera folgt einem Objekt, Drehen und Zoomen um das Objekt |
| `url.ts` | Fokus in der Adresse: `#/karte?follow=sat/iss&follow.t=…`; Slug und Zusatzwerte gibt die Quelle an |
| `debug.ts` | Testszene, fliegt am Ende raus |

Warum eigener Framebuffer: MapLibres Tiefenpuffer enthält auf dem Globus den Abstand zur Horizontebene
(`globeComputeClippingZ`), keine echte Tiefe. Labels danach lesen ihn weiterhin, also bleibt er unberührt.

## Phasen

| # | Inhalt | Fertig, wenn | Tage |
|---|---|---|---|
| 1 | `GeoStage` fest in `views/globe.ts`, Testszene raus, `GeoLine` mit Strichelung und Ausblenden | Stage läuft immer mit, Karte unverändert | 2 |
| 2 | Bögen: `GeoArc`, Geldflüsse als echte Bögen | Bögen in beiden Projektionen, Klicks gehen | 2 |
| 3 | Flugzeuge migrieren (`planes3d.ts`, `airport3d.ts`), `globeShown()` entfernen | Spur und Route auf dem Globus, flache Karte unverändert | 3 |
| 4 | Schiffe, Fahrzeuge, `camview3d` migrieren, `GLOBE_FLAT_ZOOM` entfernen | keine Mercator-Rechnung mehr in Layern | 1–2 |
| 5 | Satelliten: `GeoPoints`, `GeoOrbit`, ISS-Modell | Starlink flüssig, Orbit beim Anklicken | 2–3 |
| 6 | Weltweite Flugzeuge mit Instancing und Detailstufen (`air.ts:64` befüllt heute nur die 2D-Quelle), Doku in `NEUER-LAYER.md` | flüssig bei Zoom 2 mit vollem Weltdatensatz | 2 |

Nach Phase 4 entscheiden: Patch `patches/maplibre-gl@6.14.0.patch` entfernen (Übergang wieder bei Zoom
11–12)? Der neue Renderer braucht ihn nicht mehr. `SurfaceModels` in `planetmap.ts` kann später folgen.

## Anforderungen aus den Tests

**Klick auf bestehende Objekte im Fokus (Phase 3/4):** Heute beendet der erste Klick auf ein 2D-Schiff nur
den Fokus, erst der zweite wählt es aus und öffnet die Seitenleiste. Ein Klick muss reichen: Der Fokus
endet und das Objekt wird ausgewählt. Der Klick gilt nur als „daneben“, wenn er auch sonst nichts trifft.

**Andere Kamerabefehle im Fokus (Phase 1):** Ortssuche, Panels, Zoom-Knöpfe, Neigungsregler und
Kompass kennen den Fokus nicht. Sie müssen ihn beenden oder an ihn weitergegeben werden. Das
betrifft auch den Flug-Follow in `flightpanel.ts` und die Navigation in `routing/locator.ts`, die
beide selbst die Kamera führen: Am Ende gibt es nur noch einen Kamera-Führer.

**Gelände (Phase 3):** Der Renderer rechnet mit Höhe 0. Modelle am Boden und Pins brauchen die Geländehöhe
(`queryTerrainElevation`), sonst stecken sie im Berg. Noch offen ist der Lag bei eingeschaltetem 3D-Gelände:
Gelände wird in jedem Frame neu gezeichnet, und bewegte Objekte erzwingen Dauer-Neuzeichnen. Es ruckelt auch ohne
`?geo3d` etwas, Gelände kostet also schon selbst; mit `?geo3d` ist es stärker. Vor Phase 3 mit und ohne Stage
messen (Kamera stehend und bewegt). Die Stage drosselt bei stehender Kamera auf 15 fps. Die alten Layer (`planes3d`, `ships3d`, `vehicles3d`) drosseln
nicht und bekommen das mit der Migration.

**`moveend` im Fokus:** Bei bewegtem Ziel endet in jedem Frame eine Kamerabewegung. `views/globe.ts` filtert das
schon über `geo3dFocus`, `overlay.ts` (Wind) noch nicht.

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
