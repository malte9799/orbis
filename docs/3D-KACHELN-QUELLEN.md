# 3D-Kacheln: gefundene Quellen, die nicht eingebaut sind

Stand der Suche: Oktober 2026. Eingebaut sind alle Quellen in `src/globe/tiles3dSources.ts`.
Hier steht, was wir gefunden, aber **nicht** aufgenommen haben, und warum.

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
