# Plan: Orbis → Niveau ARGOS ATLAS (Datenlayer & Geschwindigkeit)

Stand: 2026-11-07. Base-Map ausgeschlossen (Orbis behält seine Kartenquellen).
Ziel: Flugzeuge, Schiffe, Events (inkl. VERIFIED), Kameras und Infrastruktur
genauso schnell und so „lebendig“ wie bei ARGOS ATLAS laden – bei gleichem
oder geringerem Datenvolumen.

## 0. Wie ARGOS das macht (beobachtet)

| Mechanismus | ARGOS | Orbis heute |
|---|---|---|
| Transport | Cloudflare CDN, HTTP/3, `max-age=604800`, ETag, `cf-cache-status: HIT` | GitHub Pages, kein CDN-Cache-Tuning |
| Statische Punkte | **PMTiles** (Kameras `cams-balanced-*.pmtiles`, Infra `infra-balanced-*.pmtiles`) mit HTTP-Range (206) | GeoJSON-Fetches, teilweise Overpass live |
| Base-Map-Vektortiles | Versionierter Pfad `/tiles/basemap/<version>/<z>/<x>/<y>.pbf` (immutable) | Vektor-Tiles je nach Anbieter |
| Live-Flüge | Snapshot `/api/flights` wird **im HTML geparst vor** dem Bundle geladen (preload), dann Polling `/api/flights/f/m|w/<id>` mit Cache-Buster | OpenSky + adsb.lol, 2 min Cache, Proxy |
| Live-Schiffe | `/api/vessels_index` Snapshot | aisstream.io WebSocket |
| Events (verified) | `/api/osint` (GeoConfirmed) + `/api/osint_fast`, GDELT, UCDP | USGS/NASA EONET/FIRMS etc. |
| Client-Cache | localStorage/IndexedDB mit TTL, Merge „liveSeen“ | `kvSet`/`hydrate` (IndexedDB) vorhanden |
| Renderer | MapLibre + eigener Icon-Atlas (Canvas-Sprite, 2×), Glow/Halo/Hit-Layer, zoom-abhängige Icons | MapLibre, eigene Marker |

**Kernidee:** Statische/global Daten als versionierte, cachebare Tiles (PMTiles) ausliefern;
Live-Daten als kompakte Snapshots mit Preload + Polling + clientseitigem TTL-Cache +
inkrementellem Diff-Update; Punkte über einen zentralen Icon-Atlas rendern.

---

## 1. Datenquellen angleichen (ARGOS → Orbis)

### 1.1 Flugzeuge
- **Bereits vorhanden:** OpenSky (Weltübersicht), adsb.lol `/v2/mil`, adsb.lol `/v2/point`.
- **Neu von ARGOS übernehmen:**
  - adsb.lol `/v2/hex/{hex}` als Detail-Fallback (Typ, Reg, Operator) – wie Orbis `loadAircraftByHex`.
  - adsbdb `/v0/aircraft/{hex}` für Typ/Modell/Kennzeichen (Fallback).
  - Route/Flugplan aus readsb `route` (bereits teilweise).
  - **GNSS-Jamming (NIC/NACp)** aggregiert auf Hex-Raster (Orbis hat `gnss.ts` – prüfen, ob aus Flight-Daten abgeleitet).
- **Speed:** Snapshot-Endpunkt wie ARGOS `/api/flights` (serverseitig aggregiert) – für Orbis statisch nicht möglich →
  stattdessen **Client-Snapshot in IndexedDB** + Hintergrund-Refresh; optional Cloudflare Worker als Proxy/Aggregator.

### 1.2 Schiffe
- **Bereits vorhanden:** aisstream.io (WebSocket).
- **Neu:** Snapshot-ähnlicher Einstieg (`vessels_index`-Pattern): beim ersten Laden ein kompakter
  Snapshot (MMSI, lat, lon, Kategorie, SOG) aus Cache/Proxy, dann WS-Deltas.
- AIS-Kategorien (cargo, tanker, fishing, passenger, sailing, other, military) wie ARGOS.
- **Dark vessels / sanctioned** als eigene Views (Orbis hat Dark-Ships? prüfen).

### 1.3 Events (inkl. VERIFIED = GeoConfirmed)
- **Neu:** `/api/osint`-Äquivalent für Orbis: GeoConfirmed-Events (verifizierte, geolokalisierte Ereignisse mit Medien).
  Datenquelle: GeoConfirmed (community). Lädt als JSON-Snapshot (90-Tage-Fenster wie ARGOS).
- Bestehende Feeds ergänzen: GDELT (Presse-Events), UCDP (Konflikte mit Opfern), USGS (Beben),
  NASA EONET (Vulkane/Feuer/Stürme), FIRMS (Feuerfoci), GDACS (Alarme), NHC (Hurrikan-Kegel), WHO (Ausbrüche).
- **Verified-Layer** als eigener Intel-Layer mit Media (Bild/Video) wie ARGOS (`osint-ev-*`).

### 1.4 Kameras
- **Neu:** Kamera-Index als PMTiles + `/api/cameras_index.json`-Äquivalent (Orbis hat `cams.ts`/`camfeeds.ts`).
  Umstellung von GeoJSON auf PMTiles für schnelleres initiales Laden.
- Weitere Feeds (ARGOS-Liste): WSDOT, TxDOT, Tarktee, Freeway Bureau Taiwan, Toronto RESCU, DelDOT HLS, etc.
  (Orbis hat PLAN-GEV-QUELLEN.md – dort abhaken).

### 1.5 Infrastruktur
- **Neu:** Infra als PMTiles (`infra-balanced-*.pmtiles`) statt Overpass-live (Overpass bleibt für Detail).
- Airports (OurAirports), Ports, Power, Datacenters, Dams, Cables, Resources, HQs.

### 1.6 Weitere ARGOS-Quellen (optional, nach Priorität)
- GNSS-Jamming, Hurrikan-Kegel, Leihräder (GBFS), GTFS-RT Fahrzeuge, Wind (GFS/IFS), Wolken (EUMETSAT),
  Blitze (NOAA nowCOAST), Satelliten (CelesTrak), Radio (Radio Browser), Militärbasen (OSM/Overpass).

---

## 2. Geschwindigkeit – konkrete Maßnahmen

### 2.1 Caching & Transport
- **Datenhosting via Orbismap/data** (R2-Buckets hinter Custom Domain `*.maltee.dev`, Cloudflare-CDN):
  - `orbis-live` (Minuten-/Stundensnapshots, `max-age=60–600`)
  - `orbis-data` (täglich/wöchentlich: Events, Kameras, Infra, VIP, …)
  - `orbis-osm` (PMTiles für OSM-Punkte)
  - `orbis-assets` (Modelle/Texturen)
- Versionierte Pfade + `manifest.json` pro Bucket (Pfad → updated/etag/bytes/source/license).
- CORS je Bucket: `Range` erlaubt (PMTiles), `ETag`/`Content-Range` freigegeben.
- Cloudflare Cron (`orbis-clock`) dispatcht GitHub-Actions-Workflows (live-15m, live-1h, daily, weekly, manual).

### 2.2 Statische Daten als PMTiles
- Kamera-Index und Infra-Punkte nach Zoom/Region in PMTiles packen (Orbis nutzt schon `pmtiles`-Dependency).
- Generierung im `data`-Workflow (`scripts/fetch-data.ts`), Upload auf `data`-Branch oder R2.
- Client: `pmtiles` + MapLibre Protocol, Range-Requests.

### 2.3 Live-Snapshots + Preload
- Für Flüge/Schiffe/Events: beim ersten Laden Snapshot aus IndexedDB anzeigen (stale-while-revalidate),
  dann Hintergrund-Refresh.
- HTML-Preload wie ARGOS: `<link rel="preload" as="fetch" href="/data/flights-snapshot.json">`
  (statisch generiert oder via Worker).
- Polling mit Cache-Buster (`?t=…`) nur für Frische, dazwischen Cache.

### 2.4 Inkrementelle Updates
- Live-Punkte nicht komplett ersetzen, sondern diffen (MMSI/Hex als Key, nur geänderte updaten).
- MapLibre GeoJSON-Source mit `setData` nur bei Diff; idealerweise `updateData`/Feature-State.
- Web Worker für Parsing (Orbis hat `owx.worker.ts`-Pattern – ausweiten).

### 2.5 Client-Cache-TTL
- OpenSky 2 min, adsb.lol mil 5 min, Events 15 min, Kameras 1 h, Infra 24 h.
- Persistenz über Reloads (IndexedDB), wie Orbis `kvSet`/`hydrate`.

### 2.6 Payload reduzieren
- Nur benötigte Felder (lat, lon, id, category, name, sog).
- gzip/brotli, minified JSON, keine überflüssigen Metadaten im Snapshot.
- Aggregation serverseitig (z. B. Schiffe auf Kategorien/Raster bei niedrigem Zoom).

---

## 3. (Renderer-Stile vorerst ausgeklammert)

> Renderer/Punkt-Stile werden separat behandelt (siehe ARGOS `insignias`-Atlas).
> Dieser Plan fokussiert auf Datenquellen & Geschwindigkeit.

## 4. Phasen

### Phase A – Fundament (1–2 Wochen)
- CDN + versionierte Tiles (Cloudflare Pages/Worker).
- PMTiles-Pipeline für Kameras + Infra im `data`-Workflow.
- Icon-Atlas-Modul + erste Layer (Flights) migrieren.

### Phase B – Live-Daten beschleunigen (2–3 Wochen)
- IndexedDB-Snapshots + stale-while-revalidate für Flüge/Schiffe/Events.
- Polling mit Cache-Buster, inkrementelle Diffs.
- Web-Worker-Parsing ausweiten.

### Phase C – Neue Quellen & Verified Events (2–4 Wochen)
- GeoConfirmed-Events (Verified) als Intel-Layer mit Medien.
- GDELT + UCDP ergänzen.
- Schiffe-Snapshot + Dark/Sanctioned Views.
- Infra als PMTiles.

### Phase D – Polish (1–2 Wochen)
- Clustering bei niedrigem Zoom.
- Hover/Click-UX, Tooltips, Performance-Profiling.

---

## 5. Metriken (Ziel)

- Initiales Laden der Karte mit allen Standard-Layern: **< 2 s** (First Contentful Map).
- Flugzeug-Update (Polling): **< 500 ms** Parse + Render.
- Schiffs-Snapshot: **< 1 s** für ~10 k Schiffe.
- Events (Verified): **< 1 s** für ~2 k Events.
- Keine Full-Re-Render bei Live-Updates (nur Deltas).

---

## 6. Risiken / Offene Punkte

- Statisches Hosting (GitHub Pages) kann keine serverseitigen Snapshots → braucht Worker/R2 oder Client-Aggregation.
- CORS bei manchen Quellen → bestehendes `viaProxy()`-Muster nutzen.
- PMTiles-Generierung im CI (GitHub Actions) – Speicher/Bandbreite prüfen.
- Lizenzhinweise (ODbL etc.) müssen wie ARGOS attributions-Seite gepflegt werden.
- GeoConfirmed-Datenzugang klären (API/Scrape? ARGOS nutzt eigene Aggregation).

---

## 6b. VIP-People-Tracking (ARGOS)

> Hinweis 2026-11-09: Das VIP-Modul (`src/api/vip.ts`) ist wieder integriert (Wikidata CC0, Fotos mit Commons-Lizenz). Flugzeug-Hex-Liste und Net-Worth-Labels stammen aus ARGOS Atlas (Herkunft/Lizenz schriftlich klären), siehe `QUELLEN-LIZENZEN.md`.

Datenquellen (aus ARGOS beobachtet):
- **Personen-Stammdaten:** `/api/vip.json` – Wikidata/Forbes-ähnliche Liste (Name, Rolle, Foto, Nettovermögen, Staatsbürgerschaft, Geburtsdatum). Quellen laut ARGOS-Attributions: Wikidata (CC0), REST Countries, World Bank.
- **Bewegungsdaten:** `/api/vip/semana` – aggregierte Flugbewegungen von VIP-Jets pro Woche (Zielairports, Häufigkeiten). Abgeleitet aus Flight-Tracking (adsb.lol/OpenSky) + Aircraft-DB (Typ/Reg).
- **Unternehmens-Intel:** `/api/vip_intel` – relevante Nachrichten/Events der börsennotierten Unternehmen (EDGAR/SEC filings, News). Quelle: EDGAR (SEC), Wikidata, Global Financial Centres Index.
- **Nettovermögen:** `/api/networth` – Vermögenswerte.
- **Vermögens-Visualisierung:** Polymarket/Marktdaten via `/api/assets`.

Umsetzung in Orbis:
- Neuer Layer `vip.ts` (Personen + Unternehmen) mit Icons (star/briefcase).
- Datenpipeline: Wikidata SPARQL + Forbes-Liste (D-Branch, da Schlüssel/Rate-Limits), Flight-Matching über Mode-S/Reg.
- Wöchentliche Aggregation im `data`-Workflow.

## 6b2. VIP-Personen-Karte („Sole Info“) – Datencheck

Beispielkarte (Dieter Schwarz) benötigt folgende Datenpunkte:

| Datenpunkt | ARGOS-Quelle | Orbis vorhanden? |
|---|---|---|
| Name, Rolle, Alter, Nationalität, Beschreibung | `/api/vip.json` (Wikidata) | ❌ fehlt |
| Foto | Wikimedia Commons | ❌ (Wikimedia vorhanden, aber keine VIP-Liste) |
| Nettovermögen (+ Trend) | `/api/vip.json` + `/api/networth` | ❌ fehlt |
| Geburtsort, Bildung | `/api/vip.json` (Wikidata) | ❌ fehlt |
| Wikipedia-Link | `/api/vip.json` | ❌ fehlt |
| Unternehmen (HQ, Branche, Mitarbeiter, Gründung, Website, Börsenkurs) | `/api/vip.json` companies | ❌ fehlt (Orbis hat Firmen/HQs teilweise via Wikidata/OSM) |
| Flugzeuge (Tail, Hex, Typ) | `/api/vip.json` aircraft + by_hex | ❌ fehlt (Orbis hat Flight-Tracking, aber keine VIP-Zuordnung) |
| Yacht | `/api/vip.json` yacht + by_mmsi | ❌ fehlt |
| Heimatort (lat/lon) | `/api/vip.json` home_lon/home_lat | ❌ fehlt |
| Geopolitischer Kontext / Intelligence | `/api/vip_intel` (EDGAR/News) | ❌ fehlt |
| Aktuelle Nachrichten | `/api/vip_intel` + Medien-Feeds | ⚠️ teilweise (Press-Feeds vorhanden) |
| Flugbewegungen pro Woche | `/api/vip/semana` | ❌ fehlt |

**Fazit:** Orbis hat **keine** VIP-Personendaten. Benötigt wird eine neue Datenpipeline:
1. Wikidata SPARQL: Milliardäre + Unternehmen + HQ-Koordinaten + Bildung.
2. Flight-Matching: Mode-S Hex/Tail → VIP-Person (via adsb.lol/OpenSky).
3. AIS-Matching: MMSI → Yacht → VIP-Person.
4. Nettovermögen: Forbes-Liste oder Wikidata (P2218).
5. Unternehmens-News: EDGAR (SEC) + GDELT.
6. Generierung im `data`-Workflow, Ausgabe als `/data/vip.json`.

## 6c. Flug- & Schiffs-Historie (ARGOS)

Flughistorie:
- ARGOS referenziert „vuelos anteriores“ als **PRO-Feature** (DISTRICT-Plan).
- Quelle: **OpenSky Network** `/api/flights` (Abflüge/Ankünfte pro Flugzeug oder Flughafen) + `/api/tracks/all` (Trajektorien).
- Orbis nutzt OpenSky bereits (`src/api/transport.ts`) – Historie-Endpunkt ergänzen.
- Caching: Flugtracks 24 h, Fluglisten 1 h (TTL).

Schiffshistorie:
- ARGOS hat keine offensichtliche Schiffs-Historie-API (nur live `/api/vessels`, `/api/dark-vessels`, `/api/sanctioned-vessels`).
- Mögliche Quellen: AISStream (live), AISHub, Global Fishing Watch (für Fischerei), MarineTraffic (kostenpflichtig).
- Orbis: AISStream-WebSocket beibehalten; für Historie optional Global Fishing Watch API (kostenlos mit Registrierung).

Gating: Historie-Features können wie ARGOS hinter Opt-in/PRO liegen (Anzeigen oder DISTRICT).

---

## 6d. Integration in Orbismap/data (neue Architektur)

Neue Datenquellen werden nicht mehr in den `data`-Branch des Orbis-Repos geschrieben,
sondern als Tasks in `Orbismap/data/collectors/fetch-data.ts` + Upload nach R2:

1. **Task definieren** (in `fetch-data.ts`):
   ```ts
   await task('argos-vip', 'daily', async () => {
     const people = await fetchVipPeople(); // Wikidata SPARQL + Forbes
     write('vip/vip.json', people);
   });
   ```
2. **Gruppe wählen**: `live-15m` (minütlich), `live-1h`, `daily`, `weekly`, `manual`.
3. **Bucket wählen**: `orbis-data` für tägliche/wöchentliche Snapshots (VIP, Events, Infra).
4. **Dispatch**: Cloudflare Clock (`workers/clock`) startet Workflows per `repository_dispatch`;
   oder manuell via `workflow_dispatch`.
5. **Client-Zugriff**: `https://orbis-data.maltee.dev/vip/vip.json` (mit `manifest.json` für ETag/TTL).
6. **CORS/Cache**: automatisch via `collectors/upload.sh` (Cache-Control pro Prefix).

Für VIP-Personen, GeoConfirmed-Events und Infra-PMTiles: jeweils neue Tasks in `daily`/`weekly`.

---

## 7. Erste konkrete Schritte:

1. `src/globe/shared/iconAtlas.ts` anlegen (Port aus ARGOS `insignias`).
2. `docs/PLAN-ARGOS-ATLAS.md` (dieses Dokument) mit dem Team abstimmen.
3. Flights-Layer als ersten Kandidaten auf Icon-Atlas + Diff-Update migrieren.
4. PMTiles-Pipeline-Prototyp für Kameras (bestehende `pmtiles`-Dep nutzen).
