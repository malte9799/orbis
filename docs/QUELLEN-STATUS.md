# Quellen-Status: ARGOS ATLAS vs. Orbis

Stand: 2026-11-07. Base-Map ausgeschlossen.

Legende: ✅ integriert · ⚠️ teilweise · ❌ fehlt · 🚧 in Arbeit

## Flugzeuge
- adsb.lol (ODbL) ✅
- OpenSky Network ✅
- adsb.lol /v2/mil (Militär) ✅
- adsb.lol /v2/point (GNSS-Jamming) ✅ (gnss.ts)
- adsbdb (Flugzeug-Details) ✅ (route.ts)
- Flughistorie (OpenSky /api/flights) ⚠️ (Transport vorhanden, Historie-Endpunkt fehlt)

## Schiffe
- aisstream.io (AIS) ✅
- Fintraffic Digitraffic Marine ✅
- Dark Vessels ✅ (GFW AIS-disabling, Placeholder ohne `GFW_API_TOKEN`)
- Sanctioned Vessels ✅ (OFAC SDN Vessel-Entries)
- Schiffs-Snapshot (Worker) 🚧 (Client-Loader vorhanden, Worker scaffolded)
- Ship-Historie ⚠️ (Data-Layer/Snapshot-Contract: `ships/history.json` + `ships/tracks/{mmsi}.json`, Loader `src/api/shiphistory.ts`; keine freie globale historische AIS-Quelle ohne Registrierung/Bezahl-Keys – aisstream realtime, GFW/kommerziell nur mit Token/Vertrag; best-effort Collector-Hook)

## Events
- USGS (Beben) ✅
- NASA EONET (Vulkane/Feuer/Stürme) ✅
- NASA FIRMS (Feuerfoci) ✅
- NHC (Hurrikan-Kegel) ✅
- WHO (Ausbrüche) ✅ (DON API, weekly Snapshot)
- GDACS (Alarme) ✅
- GDELT (Presse) ✅ (neu: Loader + Collector)
- UCDP (Konflikte) ✅ (neu: Loader + Collector)
- GeoConfirmed (Verified) ✅ (neu: Loader + Feed + Gruppe)
- ISW/CTP (Frontlinien) ⚠️ (Ukraine-Front vorhanden)
- DeepStateMap (Ukraine-Front) ✅
- WarSpotting (zerstörtes Material) ✅ (ukr.warspotting.net, inoffiziell/best-effort)
- Global Conflict Tracker ✅
- War Watch ✅
- SIPRI / Global Firepower ❌
- hormuz.now ✅

## Kameras
- Fintraffic, DriveBC, Caltrans, Ontario 511, HK, Toronto, etc. ✅ (viele Feeds)
- PMTiles-Index (ARGOS-Stil) ❌ (GeoJSON/Overpass)
- Weitere Feeds (WSDOT, TxDOT, Taiwan, etc.) ⚠️ (PLAN-GEV-QUELLEN)

## Infrastruktur
- OpenStreetMap (Overpass) ✅
- Natural Earth ✅
- OurAirports ✅
- PMTiles (ARGOS-Stil) ❌
- Epoch AI (Rechenzentren) ✅

## Intelligence / Erweitert
- IMF PortWatch ✅
- IODA (Internet-Ausfälle) ✅
- Reisehinweise (US/UK/AU) ✅
- Global Energy Monitor ✅
- EIA ✅
- JODI-Oil ✅
- UN Comtrade ✅
- Sanktionslisten ✅
- Safecast / RadNet ✅
- Feodo Tracker (C2) ✅ (neu: Loader + Collector + Geo)
- C2IntelFeeds ✅ (drb-ra/C2IntelFeeds 30d, IP-Geolocation)
- MITRE ATT&CK ✅
- EDGAR (SEC) ✅
- Wikidata / GFCI ✅ (teilweise)
- Global Firepower ✅ / SIPRI ❌
- Global Conflict Tracker ✅

## Wetter & Umwelt
- Open-Meteo ✅
- GFS/IFS (Wind) ✅
- EUMETSAT (Wolken) ⚠️
- NOAA nowCOAST (Blitze) ✅
- RainViewer (Radar) ✅

## Raumfahrt
- Launch Library 2 ✅
- CelesTrak (Satelliten) ✅

## Sonstiges
- Radio Browser ✅
- OSM Militärbasen ✅
- Wikimedia Commons (Fotos) ✅
- NASA GIBS (Satellitenbilder für Events) ❌
- Panoramax/KartaView/Mapillary (Street View) ✅

## Daten-Architektur
- R2-Buckets (Orbismap/data) ✅ (neue Architektur)
- Cloudflare Cron (orbis-clock) ✅
- Collector-Tasks (live-15m, daily, weekly, manual) ✅
- PMTiles (OSM-Punkte) ✅ (osmtiles.ts)
- PMTiles (Kameras/Infra) ❌

## VIP-Personen
- Wikidata (Personen, Companies, Yachts) ✅
- Wikimedia Commons (Fotos) ✅
- adsb.lol (Aircraft-Hex) ✅ (curated list)
- Nettovermögen (Forbes/Bloomberg) ✅ (curated override)
- by_hex / by_mmsi ✅

## Status-Summary
- Integriert: ~50+ Quellen (Data-Layer/Loader+Collector; teils Placeholder/best-effort)
- Teilweise: ~7 (inkl. Ship-Historie als Snapshot-Contract ohne freie globale Historie-Quelle)
- Fehlt (echte Datenquellen): **2** — SIPRI, NASA GIBS
- Fehlt (Infrastruktur/Performance): PMTiles-Pipeline Kameras/Infra (2 Einträge), EUMETSAT-Wolken vollständig
- In Arbeit: 2 (Ship-Snapshot-Worker deploy, VIP-Aircraft/Networth-Curation)