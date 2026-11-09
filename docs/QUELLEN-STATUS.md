# Quellen-Status: ARGOS ATLAS vs. Orbis

Stand: 2026-11-09 (nach Lizenz-Audit). Base-Map ausgeschlossen.

Legende: ✅ integriert (in der UI sichtbar) · ⚠️ teilweise · ❌ fehlt · 🚧 in Arbeit · ❌ entfernt (Lizenz)

„Loader vorhanden, nicht in UI verdrahtet“ = `src/api/*.ts`-Loader (+ Snapshot) existiert, wird aber von keiner Karte/Ansicht benutzt. Annahme Lizenzen: nicht-kommerzielles Open-Source-Projekt (siehe QUELLEN-LIZENZEN.md).

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
- Dark Vessels ❌ entfernt (Lizenz) (GFW, Token/Non-Commercial)
- Sanctioned Vessels – Loader vorhanden, nicht in UI verdrahtet (OFAC SDN Vessel-Entries)
- Schiffs-Snapshot (Worker) 🚧 (Client-Loader vorhanden, Worker scaffolded)
- Ship-Historie ❌ entfernt (Lizenz) (nur Platzhalter, GFW-Token; Collector-Task entfernt)

## Events
- USGS (Beben) ✅
- NASA EONET (Vulkane/Feuer/Stürme) ✅
- NASA FIRMS (Feuerfoci) ✅
- NHC (Hurrikan-Kegel) ✅
- WHO (Ausbrüche) – Loader vorhanden, nicht in UI verdrahtet (DON API, weekly Snapshot; CC BY-NC-SA 3.0 IGO, nur nicht-kommerziell)
- GDACS (Alarme) ✅
- GDELT (Presse) – Loader vorhanden, nicht in UI verdrahtet (Loader + Collector)
- UCDP (Konflikte) – Loader vorhanden, nicht in UI verdrahtet (Live-Fallback nur mit UCDP-Token `keys.ucdp`)
- GeoConfirmed (Verified) ✅ (Loader + Feed + Gruppe; Lizenz schriftlich klären)
- ISW/CTP (Frontlinien) ⚠️ (Ukraine-Front vorhanden)
- DeepStateMap (Ukraine-Front) ✅
- WarSpotting (zerstörtes Material) – Loader vorhanden, nicht in UI verdrahtet (inoffiziell/best-effort; nur nicht-kommerziell, Quelle nennen)
- Global Conflict Tracker ❌ entfernt (Lizenz) (CFR ToU)
- War Watch – Loader vorhanden, nicht in UI verdrahtet
- SIPRI via World Bank – siehe Intelligence
- hormuz.now – Loader vorhanden, nicht in UI verdrahtet (Lizenz schriftlich klären)

## Kameras
- Fintraffic, DriveBC, Caltrans, Ontario 511, HK, Toronto, etc. ✅ (viele Feeds)
- PMTiles-Index (ARGOS-Stil) ❌ (GeoJSON/Overpass)
- Weitere Feeds (WSDOT, TxDOT, Taiwan, etc.) ⚠️ (PLAN-GEV-QUELLEN)

## Infrastruktur
- OpenStreetMap (Overpass) ✅
- Natural Earth ✅
- OurAirports ✅
- PMTiles (ARGOS-Stil) ❌
- Epoch AI (Rechenzentren) – Loader vorhanden, nicht in UI verdrahtet

## Intelligence / Erweitert
- IMF PortWatch – Loader vorhanden, nicht in UI verdrahtet (nur nicht-kommerziell; „IMF PortWatch“ nennen)
- IODA (Internet-Ausfälle) ✅
- Reisehinweise (US/UK) – Loader vorhanden, nicht in UI verdrahtet; AU/Smartraveller ❌ entfernt (Lizenz/Terms ungeklärt)
- Global Energy Monitor – Loader vorhanden, nicht in UI verdrahtet
- EIA – Loader vorhanden, nicht in UI verdrahtet (Live nur mit eigenem Key `keys.eia`)
- JODI-Oil ❌ entfernt (Lizenz)
- UN Comtrade ❌ entfernt (Lizenz)
- Sanktionslisten – Loader vorhanden, nicht in UI verdrahtet
- Safecast / RadNet ✅
- Feodo Tracker (C2) – Loader vorhanden, nicht in UI verdrahtet
- C2IntelFeeds – Loader vorhanden, nicht in UI verdrahtet (CC BY-NC-SA 4.0, nur nicht-kommerziell)
- MITRE ATT&CK – Loader vorhanden, nicht in UI verdrahtet
- EDGAR (SEC) – Loader vorhanden, nicht in UI verdrahtet (nur Snapshot, kein Live-Fallback im Browser)
- Wikidata / GFCI ✅ (teilweise)
- Global Firepower ❌ entfernt (Lizenz)
- SIPRI via World Bank – Loader vorhanden, nicht in UI verdrahtet (nur World-Bank-Indikatoren MS.MIL.XPND.CD / GD.ZS, CC BY 4.0; kein sipri.org)

## Wetter & Umwelt
- Open-Meteo ✅ (freie API nur nicht-kommerziell; Re-Hosting B, siehe Lizenzen)
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
- NASA GIBS (Capabilities-Parser) – Loader vorhanden, nicht in UI verdrahtet (die GIBS-Kacheln in style.ts sind separat und sichtbar)
- Panoramax/KartaView/Mapillary (Street View) ✅

## Daten-Architektur
- R2-Buckets (Orbismap/data) ✅ (neue Architektur)
- Cloudflare Cron (orbis-clock) ✅
- Collector-Tasks (live-15m, daily, weekly, manual) ✅
- PMTiles (OSM-Punkte) ✅ (osmtiles.ts)
- PMTiles (Kameras/Infra) ❌

## VIP-Personen
- ⚠️ wieder integriert (offenes, nicht-kommerzielles Projekt): `src/api/vip.ts` (Loader `vip/vip.json`) + Collector-Task `vip` (Orbismap/data, weekly). Herkunft je Teil:
  - Wikidata (Personen, Firmen, Yachten, Foto-Verweis P18): CC0 ✅
  - Fotos: Wikimedia Commons, nur frei lizenziert (CC/PD), Lizenz + Urheber je Person gespeichert (`photo_license`, `photo_credit`), Anzeige mit Credit ✅
  - Flugzeug-Hex-Liste und Vermögenslabels: aus dem ARGOS Atlas kopiert, Herkunft/Lizenz unklar (schriftlich klären, Freigabe offen) ⚠️
  - Personenbezug: private Flugzeug-Hex-Codes benannter Personen = personenbezogene Daten (DSGVO-Hinweis); Löschweg über die Kontaktangabe in der README (dort noch zu ergänzen).

## Status-Summary
- In der UI sichtbar: die ursprünglichen Orbis-Quellen (Flugzeuge, Schiffe, Events, Kameras, Wetter, Raumfahrt, ...) plus GeoConfirmed.
- Loader vorhanden, nicht in UI verdrahtet: GDELT, UCDP, WHO, WarSpotting, War Watch, hormuz.now, IMF PortWatch, Epoch AI, GEM, EIA, Sanktionslisten, Feodo, C2IntelFeeds, MITRE ATT&CK, EDGAR, Reisehinweise (US/UK), SIPRI via World Bank, NASA-GIBS-Parser.
- Entfernt (Lizenz): Global Firepower, CFR Global Conflict Tracker, JODI-Oil, UN Comtrade, Dark Vessels (GFW), Ship-Historie, Smartraveller (AU). VIP ist wieder drin (siehe VIP-Personen, Teile mit unklarer Lizenz).
- Fehlt (Infrastruktur/Performance): PMTiles-Pipeline Kameras/Infra, EUMETSAT-Wolken vollständig, Ship-Snapshot-Worker deploy
