# Plan: weitere 3D-Datenquellen aus der Recherche

Stand: 2026-11-01. Grundlage sind der lokale Quellenkatalog und die Quellen nach Renderklasse im Obsidian-Vault sowie der aktuelle Orbis-Quellenkatalog unter `src/globe/tiles3dSources.ts`. Der Vault bleibt Recherchematerial und wird nicht Teil eines Orbis-Commits oder Pull Requests.

## Ausgangslage

Orbis kann OGC-3D-Tiles mit `TilesRenderer` laden. Für implizites Tiling ist `ImplicitTilingPlugin` bereits registriert; der Loader verarbeitet b3dm und glb. Quellen werden in `TILES_SOURCES` verwaltet. Das Quellenmenü umfasst bereits die vorhandenen internationalen und deutschen Katalogeinträge, darunter basemap.de, Berlin-LoD2, Brandenburg, NRW-LoD2, fünf Basel-Datensätze, Helsinki, Rotterdam und weitere Städte.

Die Vault-Notiz enthält deutlich mehr als fertige Tilesets. Sie mischt direkte Streaming-Dienste, herunterladbare Daten, andere Standards (I3S/SLPK), Rohdaten und Viewer ohne bestätigte Export- oder Weiterverwendungsrechte. Deshalb sollte die Aufnahme nach tatsächlichem Zugriff und Format erfolgen, nicht nach der Anzahl der Notizen.

## Vorgeschlagene Arbeitspakete

| Reihenfolge | Quelle / Gruppe | Was fehlt | Nächster Schritt | Einbauentscheidung |
|---|---|---|---|---|
| 1 | **Bremen LoD1** | ✅ **Verifiziert und eingebaut (2026-11-01):** öffentliches Tileset `https://bremen.virtualcitymap.de/datasource-data/16a95b2f-b6a9-4157-a474-2c6d31f5808a/tileset.json` (MetaVer-Eintrag „3D Tiles (CESIUM) 3D-Gebäudemodell LoD1 Land Bremen“). Geprüft: 3D Tiles 1.0, explizites Tiling, b3dm, WGS84-Regionen, HTTP 200 + `access-control-allow-origin: *`. Lizenz **CC BY 4.0**, Open Data/HVD seit 2024 (Datenstand 09.03.2026). Deckung nur **Stadt Bremen, nicht Bremerhaven** (Tileset-BBox 8,5–9,0° O, 53,0–53,2° N). LoD2-Tileset meldet S3 `AccessDenied` | Restprobe in Orbis (Debug3D + Wechsel) | Direkt in `TILES_SOURCES` als Gebäudeblöcke aufgenommen; LoD2 zurückgestellt |
| 2 | **Hamburg 3D-Mesh 2022** | ⏸️ **Zurückgestellt (2026-11-01), Analyse ohne Download:** MetaVer nennt nur den [ZIP-Download](https://www.daten-hamburg.de/opendata/3dmesh/3D-Mesh_HH_2022.zip) (13,2 GB, dl-de/by-2.0, Datenstand 03/2022); kein Streaming-Endpunkt, Geoportal-3D-Viewer listet nur LoD3-Gebäude/Gelände. ZIP ist Range-tauglich (`accept-ranges: bytes`, CORS `*`); ZIP-Zentralverzeichnis per HTTP-Range gelesen: Root-Tileset `3Dtiles_reduziert-aufgeloest/tileset_reduziert-aufgeloest.json` (3D Tiles 1.0) verweist auf **122 Kachel-Tilesets**, die als 122 Einzel-ZIPs im Archiv liegen (nur 3 ausgepackt, ~316 MB). **Idee konserviert: „ZIP-Range-Streaming-Worker“** – Proxy-Endpoint holt pro Anfrage nur die gewünschte b3dm/JSON via Range aus dem ZIP, entpackt sie und bedient einen synthetischen 3D-Tiles-Baum; ein vorab per Range-Zugriff erzeugtes Offset-Index (~100 KB) liegt im Repo. Kein 13-GB-Download, kein permanenter Kopie-Host. Umsetzung erst bei Bedarf (Prototyp-Tiefe: 1 Kachel als Funktionsbeweis), alternativ/parallel Anfrage an LGV Hamburg wegen eines Streaming-Dienstes à la Bremen | Erste Aktivierungsstufe: Worker-Prototyp mit einer Kachel | Kein Einbau, solange kein Streaming-Host steht |
| 3 | **Speyer LoD2** | 🔍 **Recherchiert (2026-11-01):** [UDZ Los 2](https://www.speyer.de/de/standort/forschung-und-entwicklung/udz-urbaner-digitaler-zwilling/udz-los-2/) wird vom Auftragnehmer HxGN Safety & Infrastructure auf Hexagon M.App Enterprise umgesetzt; der LoD2-OGC-3D-Tiles-Service ist Teil der städtischen Plattform, keine öffentliche Tileset-URL, keine Lizenzangabe. Die Datengrundlage ist das **amtliche Gebäudemodell Rheinland-Pfalz LoD2**, das als Open Data/HVD über den [GeoShop RLP](https://geoshop.rlp.de/opendata-geb3dlo.html) verfügbar ist (CityGML). Damit existiert ein eigenständiger Weg: LoD2 selbst beziehen und konvertieren (siehe AP 7), unabhängig von einer Speyer-Freigabe | Stadt Speyer um öffentliche Service-URL, CORS und Nutzungsfreigabe bitten (Entwurf unten); parallel RLP-LoD2 als Konvertierungs-Pilot-Kandidat prüfen | Service-URL nur mit Freigabe; Konvertierungspfad separat |
| 4 | **NRW Foto-Mesh** | SceneServer ist I3S; SLPK-Downloads sehr groß. Eine b3dm-Variante ist laut Recherche registrierungspflichtig | Zuerst Zugriff und Bedingungen für den b3dm-Weg verifizieren; eine einzelne Kachel technisch erproben | b3dm direkt mit bestehendem Renderer prüfen. SLPK/I3S nur mit eigenem technischen Arbeitspaket; nicht alle 81 Pakete auf einmal laden |
| 5 | **Bayern DOM-Mesh** | SLPK/I3S, große Lose, CC BY 4.0; kein OGC-3D-Tiles-Endpunkt | Ein geeignetes kleines Los wählen und Konvertierung bzw. I3S-Reader als Prototyp vergleichen | Erst nach geprüftem Ausschnitt, Attribution und tragfähigem Hosting aufnehmen |
| 6 | **Erfurt 3D-Stadtmodell** | CityGML/Geoportal statt belegtem Tileset | Verfügbarkeit der CityGML-Dateien, Lizenz und Konvertierungsrechte prüfen | Als separates Konvertierungsprojekt; nicht als direkter Stream ausgeben |
| 7 | **Weitere offene LoD-Gebäudedaten** | BKG, Baden-Württemberg, Sachsen, Leipzig, NRW-Städte, Rheinland-Pfalz, Niedersachsen, Schleswig-Holstein, Sachsen-Anhalt und weitere liegen überwiegend als CityGML/CityJSON/Shape/Dateikacheln vor | Pro Region genau einen kleinen Datensatz mit maschinenlesbarer Lizenz, Download und Datenmodell auswählen | Erst einen Konvertierungs-Pilot umsetzen; danach weitere Gebiete über denselben dokumentierten Pipelineweg hinzufügen |

## Eigene Recherche- und Sperrlisten

### Erst Endpunkt und Rechte klären

- **Nürnberg, Düsseldorf, Würzburg und Kassel:** öffentliche Viewer sind belegt; kein öffentliches Bulk-Tileset bzw. keine ausreichende Lizenzfreigabe für die Orbis-Einbindung dokumentiert.
- **Berlin-Fotomesh:** eigenständige Quelle neben dem schon eingebauten texturierten Berlin-LoD2. OBJ-Download, Wartungsmeldung und eingeschränkte Nutzungsbedingungen machen dies derzeit zu keinem direkten Tileset-Einbau.
- **Saarland:** Zugang und Lizenz für Mesh nicht ausgewiesen.
- **Gelsenkirchen:** geschlossene bzw. unklare Lizenz.
- **Esri-Demos und weitere Viewer:** technische Erreichbarkeit allein ist keine Freigabe zur öffentlichen Weiterverwendung. Pro Quelle Nutzungsbedingungen des Dateninhabers prüfen.

Diese Einträge bleiben im Recherchebestand. Sie werden erst für die Implementierung eingeplant, wenn sowohl Datenzugriff als auch öffentliche Nutzung geklärt sind.

### I3S als separates Architekturthema

Köln, Dresden, Genf, Winterthur und weitere in der Vault-Liste genannte Quellen verwenden I3S/SceneServer. SLPK ist ebenfalls nicht automatisch ein OGC-3D-Tiles-Datensatz. Der bestehende Tiles-Renderer lädt diese Formate nicht von selbst.

Vor einer allgemeinen I3S-Unterstützung sollte ein kleiner Prototyp mit einer offenen, lizenzierten und stabil erreichbaren Quelle zeigen, dass Darstellung, CORS, Authentifizierung, Metadaten und Speicherbedarf in Orbis passen. Falls kein geeigneter Kandidat vorliegt, ist eine erlaubte Konvertierung einzelner Datensätze der kleinere erste Schritt. Keine Abhängigkeit oder Konvertierungspipeline auf Verdacht einführen.

### Terrain und Rohdaten nicht als Mesh-Quellen verbuchen

Mapterhorn Terrain und Re:Earth Terrain sind Höhen-/Terrainquellen, keine fotogrammetrischen Stadtmeshes. DOP, DOM/DGM, bDOM/LAS/LAZ und Schrägluftbilder sind Ausgangsdaten, aus denen erst eine eigene Verarbeitung entstehen müsste. Diese Kandidaten gehören in eigene Vorhaben für Terrain, Texturierung oder Mesh-Erzeugung und nicht als Tileset-Einträge in `TILES_SOURCES`.

## Integrationsablauf pro Quelle

1. **Nachweis:** genaue Dataset-Seite, direkter Root-Endpunkt, Lizenztext, Attribution, Datenstand und verantwortlicher Anbieter dokumentieren.
2. **Formatprobe:** Tileset-JSON und eine repräsentative Tile-Antwort prüfen. OGC-3D-Tiles-Version, b3dm/glb, explizites oder implizites Tiling, URI-Auflösung, Höhenbezug, CORS, MIME-Typen und Authentifizierung erfassen.
3. **Kleine Sichtprobe:** genau eine Region und ein Zoomniveau laden. Position, Orientierung, Materialien, LOD-Wechsel, Abdeckungsrand und Requestverhalten prüfen.
4. **App-Eintrag:** erst dann stabile ID, passende Renderklasse, verständlichen Hinweis, Fokuskoordinaten, URL bzw. Schlüsselanforderung und Attribution in `src/globe/tiles3dSources.ts` ergänzen.
5. **Bedienung und Pflege:** Quelle in Debug3D auffindbar machen, Ein-/Ausschalten und Wechsel prüfen, Quelle in `docs/DATENQUELLEN.md` dokumentieren und Status als „verifiziert“, „eingeschränkt“ oder „Recherche“ kenntlich halten.
6. **Betrieb:** große Downloads extern hosten; Datenvolumen, Cache/CDN, Aktualisierung und Ausfallverhalten vor Veröffentlichung planen.

## Kontakt-Entwürfe

### Stadt Speyer (UDZ Los 2, Stand 2026-11-01)

> Liebe Kolleginnen und Kollegen,
>
> wir entwickeln Open-Source-Kartenprojekte, in denen amtliche 3D-Tiles-Datensätze dargestellt werden, und haben über die Seiten zum Urbanen Digitalen Zwilling (UDZ Los 2) Ihren LoD2-Dienst gefunden, der CityGML-Daten als OGC 3D Tiles bereitstellt.
>
> Könnten Sie uns mitteilen:
>
> 1. Ist der LoD2-OGC-3D-Tiles-Service öffentlich zugänglich, und wenn ja, unter welcher URL?
> 2. Falls ja: Ist er ohne Authentifizierung und mit Cross-Origin-Headern (CORS) von Browser-Clients abrufbar?
> 3. Unter welcher Lizenz dürfen die Daten in offenen, öffentlich zugänglichen Anwendungen dargestellt werden (gewünschte Attribution, Einschränkungen)?
>
> personalisiert abschicken an: Stadt Speyer, über das UDZ-Kontaktformular bzw. die örtliche Vermessungsstelle.

## Abnahmekriterien

- Quelle lädt in Orbis über einen stabilen, dokumentierten Zugriffspfad.
- Position, Höhe, Ausschnitt und LOD-Verhalten sind visuell geprüft.
- Lizenz, Attribution, Schlüsselbedarf und bekannte Einschränkungen sind korrekt angegeben.
- Umschalten und Quellenwechsel hinterlassen keine laufenden Requests oder Renderer-Ressourcen.
- Bei großen oder landesweiten Daten ist das erwartete Downloadvolumen geprüft; alle Quellen werden nicht gleichzeitig aktiviert.
- Der Orbis-Commit enthält nur notwendige App- und Projektdokumentation. Vault-Dateien und Originalarchive bleiben ausgeschlossen.

## Empfohlene erste Umsetzung

1. ✅ Bremen-Endpunkt und Lizenz verifiziert und LoD1-Eintrag umgesetzt (siehe Tabelle oben); noch ausstehend: visuelle Probe in Orbis (Debug3D, Umschalten).
2. ⏸️ Hamburg als **ZIP-Range-Streaming-Worker-Idee** dokumentiert (Tabelle oben); Umsetzung oder LGV-Anfrage erst wieder bei Bedarf.
3. 🔍 Speyer recherchiert (Tabelle oben): interne Hexagon-Plattform, kein öffentlicher Endpunkt. **Kontakt-Entwurf** (Abschnitt „Kontakt-Entwürfe“) versenden, parallel RLP-LoD2 als Konvertierungs-Pilot weiter beurteilen.
4. Danach einen kleinen Bayern-/**RLP-LoD2-Pilot** auswählen – RLP ließe sich mit der Speyer-Anfrage koppeln, Bayern (CC BY 4.0, 2-km-Kacheln) ist der einfachste Startpunkt. I3S-Unterstützung nur dann verallgemeinern, wenn der Pilot den Bedarf belegt.
5. Quellen ohne Freigabe oder Endpunkt im Recherche-Backlog belassen; Terrain- und Rohdaten in getrennten Vorhaben behandeln.

## Betroffene Orbis-Dateien bei Umsetzung

- `src/globe/tiles3dSources.ts` – Quelle, Renderklasse, URL, Fokus und Attribution.
- `src/globe/tiles3d.ts` und `src/globe/tiles/` – nur bei nachgewiesenem Rendererbedarf.
- `docs/DATENQUELLEN.md` – geprüfte Datenquelle, Lizenz, Attribution und Einschränkungen.
- Keine Änderungen am Obsidian-Vault als Teil des Orbis-Pull-Requests.
