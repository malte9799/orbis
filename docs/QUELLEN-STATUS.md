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
- Dark Vessels ❌
- Sanctioned Vessels ❌
- Schiffs-Snapshot (Worker) 🚧 (Client-Loader vorhanden, Worker scaffolded)
- Ship-Historie ❌

## Events
- USGS (Beben) ✅
- NASA EONET (Vulkane/Feuer/Stürme) ✅
- NASA FIRMS (Feuerfoci) ✅
- NHC (Hurrikan-Kegel) ✅
- WHO (Ausbrüche) ❌
- GDACS (Alarme) ✅
- GDELT (Presse) ✅ (neu: Loader + Collector)
- UCDP (Konflikte) ✅ (neu: Loader + Collector)
- GeoConfirmed (Verified) ✅ (neu: Loader + Feed + Gruppe)
- ISW/CTP (Frontlinien) ⚠️ (Ukraine-Front vorhanden)
- DeepStateMap (Ukraine-Front) ✅
- WarSpotting (zerstörtes Material) ❌
- Global Conflict Tracker ❌
- War Watch ❌
- SIPRI / Global Firepower ❌
- hormuz.now ❌

## Kameras
- Fintraffic, DriveBC, Caltrans, Ontario 511, HK, Toronto, etc. ✅ (viele Feeds)
- PMTiles-Index (ARGOS-Stil) ❌ (GeoJSON/Overpass)
- Weitere Feeds (WSDOT, TxDOT, Taiwan, etc.) ⚠️ (PLAN-GEV-QUELLEN)

## Infrastruktur
- OpenStreetMap (Overpass) ✅
- Natural Earth ✅
- OurAirports ✅
- PMTiles (ARGOS-Stil) ❌
- Epoch AI (Rechenzentren) ⚠️

## Intelligence / Erweitert
- IMF PortWatch ❌
- IODA (Internet-Ausfälle) ❌
- Reisehinweise (US/UK/AU) ❌
- Global Energy Monitor ❌
- EIA ❌
- JODI-Oil ❌
- UN Comtrade ❌
- Sanktionslisten ❌
- Safecast / RadNet ✅
- Feodo Tracker (C2) ✅ (neu: Loader + Collector + Geo)
- C2IntelFeeds ❌
- MITRE ATT&CK ❌
- EDGAR (SEC) ❌
- Wikidata / GFCI ✅ (teilweise)
- Global Firepower / SIPRI ❌
- Global Conflict Tracker ❌

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
- Integriert: ~35 Quellen
- Teilweise: ~8
- Fehlt: ~25 (viele Intelligence/Erweiterte Quellen)
- In Arbeit: 2 (Ship-Snapshot, VIP-Aircraft-Curation)
EOF
echo done