# 3D-Kacheln: gefundene Quellen, die nicht eingebaut sind

Stand der Suche: Oktober 2026 (Nachtrag November 2026). Eingebaut sind alle Quellen in `src/globe/tiles3dSources.ts`.
Hier steht, was wir gefunden, aber **nicht** aufgenommen haben, und warum.

## Nachtrag November 2026: neue Funde (Schwerpunkt Deutschland, fotorealistisch)

Ziel der Nachrecherche: fotorealistische, kostenlose Datenquellen für Deutschland.
Wichtigste Erkenntnis: **NRW hat als erstes Bundesland ein landesweites Foto-Mesh als
Open Data** („größtes 3D-Mesh abseits von Google und Apple", con-terra, 2024) –
allerdings nur als Nadir-DSM-Mesh (2,5D) und bisher ohne 3D-Tiles-Streaming-Dienst.

### Direkt als OGC 3D Tiles, kein Schlüssel (verifiziert)

| Quelle | Inhalt | URL | Lizenz |
|---|---|---|---|
| DE NRW 3D-Gebäudemodell LoD2 | ~11,6 Mio. Gebäude NRW mit standardisierten Dachformen, WGS84, implizites Quadtree-Tiling, glb-Kacheln, Metadaten-Schema | `https://ogc-api.nrw.de/3dg/v1/collections/building/3dtiles` | dl-de/zero-2.0, keine Einschränkungen |
| CH Basel-Stadt „3D-Tiles BS" | b3dm-Objektkacheln: Gebäude, Brücken, Bäume, Wald (aktuell gepflegt) | über `https://www.bs.ch/bvd/grundbuch-und-vermessungsamt/geo/geodaten/geodienste` (Link „3D-Tiles BS") | kostenlos (Basel OGD); genaue Tileset-URLs dort verlinkt |

Anmerkungen:
- NRW LoD2 nutzt **implizites Tiling** (Quadtree, Subtree-Dateien `{level}_{x}_{y}.subtree`, glb-Kacheln) und
  ein eigenes Metadaten-Schema (`schemaUri`). Die Engine v2 liest implizites Tiling inzwischen
  (`src/globe/tiles/implicit.ts`); die Quelle ist als „DE NRW LoD2" eingebaut.
- Das nackte LoD2 von NRW ist *nicht* texturiert — für Foto-Look bräuchte es eine
  Überblendung mit DOP (siehe „Selbst bauen“ unten) oder das NRW-Mesh (siehe nächster Abschnitt).

### DE: fotorealistisches Mesh landesweit (NRW), aber kein 3D-Tiles-Dienst

**3D-Mesh NRW (Geobasis NRW, Bezirksregierung Köln)** — das aktuell wichtigste freie
fotorealistische Dataset in Deutschland:

- Inhalt: Foto-Mesh (mit Luftbildern texturiertes Oberflächenmodell) für **die gesamte Landesfläche NRW**,
  GSD 10 cm, Fortführung alle 2 Jahre (Bildflug 2026/2027 läuft), Flächendeckung seit 02/2025.
- Einschränkung: Mesh wird **nur aus Nadir-Bildern** gerechnet ⇒ 2,5D/DSM-Mesh
  (keine Fassaden/Überhänge — genau das, was Google mit Schrägluftbildern ausgleicht).
- Zugänge:
  - Streaming I3S (kein 3D Tiles): `https://www.gis.nrw.de/geobasis/3D_mesh/SceneServer`
  - Open Data Download (SLPK, 81 Teilgebiete, 3–340 GB je Kachel):
    `https://www.opengeodata.nrw.de/produkte/geobasis/lusat/akt/3dmesh/` — dl-de/zero-2.0
  - **b3dm/3D-Tiles-Variante** über CODE-DE (Registrierung nötig, kostenlos, dl-de/by-2-0):
    siehe Anleitung auf der Produktseite `bezreg-koeln.nrw.de/geobasis-nrw/…/aktuelle-luftbild-und-5`
- 3D-Tiles als Format wird laut AdV-Vortrag (INTERGEO 2025) seit Juni 2025 produziert,
  ein öffentliches Streaming-Dienst (`tileset.json`) existiert aber (Stand Nov 2026) nicht —
  nur der CODE-DE-Download. Selbst-Hosting der b3dm auf eigenem CDN wäre realistisch.

### DE: fotorealistische Stadt-Modelle ohne 3D-Tiles (Open-Data-/Viewer-Projekte)

Diese Städte haben ein Foto-Mesh oder texturiertes 3D-Stadtmodell, aber keinen
verifizierten OGC-3D-Tiles-Dienst (Status: prüfen):

| Stadt | Inhalt | Zugang |
|---|---|---|
| Nürnberg | fotorealistisches 3D-Stadtmodell, seit 2024 online, „aus Luftbildern einer Befliegung" | `https://www.nuernberg.de/internet/geoinformation_bodenordnung/digitaler_zwilling.html` — bisher nur Viewer, keine Daten-URL gefunden |
| Speyer (UDZ) | 3D-Mesh (NADIR+OBLIQUE) + Super-3D-Mesh (360°-Panoramen) + LoD2 als **OGC 3D-Tiles-Service** (Hexagon M.App Enterprise) | `https://www.speyer.de/de/standort/forschung-und-entwicklung/udz-urbaner-digitaler-zwilling/udz-los-2` — 3D-Tiles-Dienst existiert laut Projektbeschreibung, URL noch nicht gefunden |
| Düsseldorf | „Düsseldorf in 3D" (Datenlizenz Deutschland Zero 2.0 laut Fraunhofer-Bericht) | `https://duesseldorf.virtualcitymap.de/public/` — VC-Map-Demo, Datasource-URL analog Berlin/Soest zu finden (config `JSON` per curl 403) |
| Würzburg | „Würzburg 3D" (Digitaler Zwilling seit 1997), LoD2 + Texturierung, Pilot Schrägbildbefliegung mit LDBV | `https://geostadtplan.wuerzburg.de/` — Bot-Daten-URL nicht offiziell |
| Kassel | „Kassel in 3D: der digitale Zwilling" (virtualcitySYSTEMS) | analog Düsseldorf prüfen |

### DE: Selbst bauen aus Freien Basisdaten (ohne 3D-Tiles-Dienst)

Weg zu einer fotorealistischen Abdeckung ohne einen einzelnen Lieferanten:

1. **Schrägluftbilder als Rohmaterial für eigene Photogrammetrie**:
   - NRW publiziert Schrägluftbilder flächendeckend als Open Data, z. B.
     „Schrägluftbilder Wuppertal 03/2024" (33.977 Bilder, dl-de/zero-2.0) —
     damit ließe sich mit einem Photogrammetrie-Tool (RealityCapture, OpenDroneMap …)
     ein echter Foto-Mesh rechnen.
   - Bremen: „Schrägluftbilder Land Bremen" Open Data (GDI-DE GeoNetwork, dort aufgelistet).
2. **LoD2-Gebäudemodelle als Open Data der Bundesländer** (CityGML/SLPK): NRW (SLPK),
   Niedersachsen (CC BY 4.0), Sachsen-Anhalt (dl-de/by-2-0), Bremen (seit 06/2024 LoD1+LoD2),
   Mecklenburg-Vorpommern (CC BY 4.0), Berlin (dl-de/zero), Rheinland-Pfalz (dl-de/zero).
   Das bundesweite LoD2-DE (ZSHH) ist dagegen gebührenpflichtig (ab 16.000 €, nur an
   „Nutzungspflichtige").
3. **DOP (Orthofotos) der Landesämter** als freie Dach-/Boden-Textur, BKG DOP20-DE, NRW DOP
   (dl-de/zero), Bayern DOP (Open Data per Gesetz) — draped auf DSM/DGM.
4. **Mapillary** (freie Lizenz) für Fassaden-Texturierung — global crowdsourced, in DE dicht.
5. **LiDAR-DOM/DGM** der Bundesländer im 1-m-Raster als Open Data
   (z. B. NRW DGM1 open, Hessen, Thüringen, Brandenburg…) als Gelände + ableitbare Vorlagen.

### International (fotoreal, kostenlos)

| Quelle | Inhalt | URL | Lizenz |
|---|---|---|---|
| Esri-Demo I3S (kein 3D Tiles, nur I3S) | Paris, Prag, New York, Tokio, Montreal, Girona (ICGC), Norfolk | `tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/…/SceneServer` (siehe Esri „Featured data layers") | Esri-Master-Liz. — nur Demo |
| Terrain Mapterhorn | Gelände-Kacheln (Terrarium 512px, WebP/PMTiles), 30 m global + hochauflösende Regionen inkl. Deutschland (v0.0.4+) | `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp` | Code BSD-3, Terraindaten aus offenen Quellen, ohne Schlüssel |
| Re:Earth Terrain | DEM-Kacheln auf Ellipsoid-Höhe (EGM2008-Blend für Cesium/three.js) | `https://terrain.reearth.land/…` | CC BY 4.0, ohne Schlüssel |

## Nur als I3S (Esri Scene Layer), kein 3D Tiles

Unsere Engine liest nur OGC 3D Tiles. Für I3S bräuchten wir einen eigenen Leser
(Knotenbaum `nodes/root`, Geometrie, Texturen, Draco, EPSG 4326/3857).
Die Dienste haben keinen `…/3DTilesServer/tileset.json`; Esri veröffentlicht 3D Tiles
als **eigenen** Dienst, und den gibt es für diese Städte nicht (Suche in ArcGIS Online: keine Treffer).

| Stadt | Inhalt | Dienst / Quelle |
|---|---|---|
| Köln | Foto-Mesh (10 Teilgebiete) + LoD2 | `tiles.arcgis.com/tiles/vLWCCENUEQqGMoPG/arcgis/rest/services/Koeln_Teilgebiet_1…10/SceneServer`, `LoD2_gebaeude_gesamt_alkis_rpk` |
| Dresden | Gebäude LOD1/LOD2/LOD3 (Mesh), Vegetation | `tiles.arcgis.com/tiles/ORpvigFPJUhb8RDF/…/Gebaeude_LOD*/SceneServer` |
| Genf | Gebäude, Bäume, Lidar-Vegetation | `tiles.arcgis.com/tiles/Yw7hmHuxwtA1GVg6/…/BATIMENT_3D/SceneServer` u. a. |
| Winterthur | Gebäudehüllen, Solarkataster | `tiles.arcgis.com/tiles/q15r81A4Jka01TMq/…/BuildingShell_ohne_Neuhegi_angepasst/SceneServer` |
| Zürich virtuell (`3d.stzh.ch`) | LoD2-Gebäude, Dachmodelle (eigenes Portal) | `3d.stzh.ch/3darcgis/rest/services/Hosted/…/SceneServer` |
| Oerlinghausen | LoD2/LoD3-Gebäude, Leitungsnetze, IFC (Digital Twin, nur Demo) | `services3.arcgis.com/JhD3NyxTJcNiae8J/…/SceneServer` |

Weg dahin: I3S-Leser bauen, oder die Stadt bitten, den Dienst als 3D Tiles freizugeben.

## Nicht zugänglich / Konfiguration nicht gefunden

- **Konstanz:** Item nicht öffentlich lesbar (HTTP 403).
- **Leipzig, Karlsruhe, Luzern:** eigene Web-App (`jimu-core`) auf dem Server der Stadt, Datenquellen nicht gefunden.
- **Bergisch Gladbach:** Link führt nur auf eine ArcGIS-Experience-Seite, keine Datenquellen darin.

## Gefunden, aber nicht brauchbar

| Quelle | Grund |
|---|---|
| Stuttgart Reality Twin (`Stuttgart_Reality_Twin`) | Gaussian Splat, kein Mesh |
| Casablanca (`casabldgs1`, `rexhansenafo`) | Antwort war kein lesbares JSON |
| 's-Hertogenbosch Luftbild-Gelände (`terrain_shb_lufo`) | Eine Kachel hat über 55 MB (WebP-Texturen) |
| 's-Hertogenbosch `panden3D_object`, `building_surface_spoorzone_*` | nur ein Ausschnitt (2,5 km), steckt schon im Gesamt-Mesh |
| `IMT__4326__…` (Esri-Demos) | liegen auf dem QA-Server `tilesqa.arcgis.com` |
| Duplikate von Zürich, Utrecht, Stuttgart, Boston, Frankfurt | bereits eingebaut |
| Hunderte Gaussian-Splat- und Drohnen-Tilesets | keine Stadt, meist ein Gebäude oder Gelände |
| `AISPECO_BAAM_UtilityCorridor_3DMesh` (Arizona) | Leitungskorridor-Mesh, keine Stadt |
| `Dubai_Downtown` (`propvr`) | Koordinaten im Tileset unplausibel |

## Eingebaut, Lizenz aber unklar

Frankfurt, 's-Hertogenbosch, Acapulco, Expo 2025 Osaka, Madrid Tetuán, Frederiksberg
und alle Esri-Demo-Quellen: vor öffentlichem Einsatz die Nutzungsrechte klären.
