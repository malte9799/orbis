# Quellen-Lizenzen (Rechts-/Nutzungsbedingungen)

Recherche-Stand: **2026-11-08**. Konsolidiert aus parallelen Agenten-Recherchen + Repo-Abgleich.
**Keine Rechtsberatung.** Maßgeblich sind die jeweils aktuellen offiziellen Bedingungen; bei Unklarheit/kommerzieller Nutzung schriftlich beim Anbieter klären.

## Repo-Befund (vor Recherche)
- `docs/DATENQUELLEN.md` und `collectors/manifest.mjs` (orbismap-data) dokumentieren Lizenzen für viele ursprüngliche Orbis-Quellen (OSM/ODbL, DWD CC BY 4.0, Open-Meteo, NASA/NOAA teils, Digitraffic CC BY 4.0 etc.).
- Für die **neuen ARGOS-aligned Intel/Data-Layer-Quellen** (GDELT, UCDP, WHO DON, WarSpotting, GCT, War Watch, Feodo, C2IntelFeeds, Sanktionslisten/OFAC/UK/EU/CA, GFW/Dark Vessels, hormuz.now, PortWatch, EIA, JODI, UN Comtrade, GEM, Epoch, EDGAR, IODA, Reisehinweise, MITRE ATT&CK, SIPRI/World Bank/GFP, NASA GIBS-Metadaten) fehlen in diesen Dateien überwiegend klare Lizenz-/Attributions-/Redistribution-Regeln.

Legende: ✅ klar offen · ⚠️ bedingt/unklar/eingeschränkt · ❗ restriktiv/kommerziell kritisch.

## Konflikt / Events

| Quelle | Lizenz/Terms | Attribution | Redistribution / kommerziell / API | URL | Unsicherheit |
|---|---|---|---|---|---|
| ✅ GDELT (GEO API 2.0) | Offene Nutzung: „unlimited and unrestricted use“ (academic/commercial/government), keine Gebühr | **Ja**: GDELT zitieren + Link `gdeltproject.org` | Redistribute/rehost/mirror erlaubt, kommerziell erlaubt; techn. API-Limits möglich | https://www.gdeltproject.org/about.html#termsofuse | Nicht mit `gdeltcloud.com` verwechseln |
| ✅ UCDP GED (API) | **CC BY 4.0**; API token-/quotenpflichtig (Doku) | **Ja** (Publikationen/Quelle) | Kommerziell/Redistribution unter CC BY 4.0; **5k req/Tag, `x-ucdp-access-token`** | https://ucdp.uu.se/downloads/ https://ucdp.uu.se/apidocs/ | Repo-Live-Fallback ruft GED 24.1 ohne Token auf — **prüfen/anpassen** |
| ⚠️ GeoConfirmed | **Keine klare öffentliche Lizenz/ToU** für GeoJSON/API gefunden | konservativ **Ja** | **Unklar** (Redistribution, kommerziell, Scraping/Caching/API-Limits) | https://geoconfirmed.org/ | **hoch** — vor produktiver/kommerzieller Nutzung Freigabe einholen |
| ⚠️❗ WarSpotting (`ukr.warspotting.net`) | Offizielle Terms **nicht verlässlich abrufbar** (403); Sekundärhinweis: „réutilisation non commerciale avec crédit“, mögliche Rate-Limits | **Ja** (konservativ) | **Unklar/restriktiv** (kommerziell ggf. nein); inoffizielle/best-effort API | https://ukr.warspotting.net/ | **hoch** — offizielle Rechte klären |
| ⚠️ CFR Global Conflict Tracker | CFR-Copyright; je Asset unterschiedliche Lizenzen, **keine eindeutige offene Datenlizenz** für genutzten Algolia-Abruf | **Ja** (CFR/GCT + Link) | Kommerziell/Bulk-Redistribution/Algolia-Nutzung **unklar/eingeschränkt**; Key ≠ Lizenz | https://www.cfr.org/global-conflict-tracker | mittel-hoch |
| ✅ War Watch (Geneva Academy) | **CC BY 4.0** (sofern nicht anders angegeben) | **Ja** (Geneva Academy, Konflikt/URL, Abrufdatum) | Teilen/Anpassen **auch kommerziell** mit Attribution | https://warwatch.ch/terms-of-use/ | Einzelfelder nicht einzeln geprüft |
| ⚠️ WHO Disease Outbreak News (DON) | Typisch WHO: **CC BY-NC-SA 3.0 IGO** (sofern nicht anders angegeben) | **Ja** | **Nicht-kommerziell** + ShareAlike; **kommerziell ggf. WHO-Genehmigung**; kein WHO-Logo ohne Genehmigung; API-spezifische Terms unklar | https://www.who.int/emergencies/disease-outbreak-news https://www.who.int/about/policies/publishing/copyright | mittel |
| ⚠️ GDACS | Terms/Disclaimer vorhanden, **keine klare offene Content-Lizenz**; „as is“, nicht Ersatz für Behördenwarnungen | konservativ **Ja** | Keine ausdrückliche Freigabe für kommerzielle Redistribution/Rehosting; vorsichtig + Disclaimer | https://www.gdacs.org/About/termofuse.aspx | mittel; in DATENQUELLEN nur als `🟢` grob |
| ⚠️ DeepStateMap | Eigene License-Agreement: **API** nur mit Zustimmung; **kommerziell vorher Genehmigung**; visuelle Materialien mit Verweis/Link teils frei (kommerziell/nicht-kommerziell) | **Ja** | API-Daten redistribution eingeschränkt; genaue Nutzung abhängig von Materialtyp | https://deepstatemap.live/license-en.html | **Nutzung im Codepfad nicht belegt** (QS ✅, Implementierung unklar) |

## Cyber / Sanktionen / Schiffe

| Quelle | Lizenz/Terms | Attribution | Redistribution / kommerziell / API | URL | Unsicherheit |
|---|---|---|---|---|---|
| ✅ Abuse.ch Feodo Tracker | **CC0** (Feodo-Ausnahme in abuse.ch Terms; „commercial and non-commercial without limitations“, as-is) | nicht zwingend, empfohlen | Kommerziell/Redistribution erlaubt | https://feodotracker.abuse.ch/ https://abuse.ch/terms-of-use/ | Datensätze teils leer (operativ) |
| ❗ C2IntelFeeds (drb-ra) | **CC BY-NC-SA 4.0** | **Ja** | **Nicht-kommerziell nur**; ShareAlike; Redistribution unter NC-Bedingungen | https://github.com/drb-ra/C2IntelFeeds | NC-Grenze auslegungsbedürftig |
| ✅ OFAC SLS (SDN/Consolidated XML) | U.S.-Regierungswerk, typ. **kein U.S.-Copyright (17 USC §105)**; SLS-Downloads vorgesehen, „as provided“ | Quellenangabe empfohlen (OFAC/Treasury) | Faktisch redistributierbar/kommerziell nutzbar; **Aktualität/Vollständigkeit** selbst sicherstellen; keine Automationsgarantie | https://ofac.treasury.gov/sanctions-list-service | Keine explizite CC-Zeile pro Seite |
| ✅ UK Sanctions List (FCDO/OFSI) | **Open Government Licence v3.0** (Crown copyright) | **Ja** (OGL) | Kommerziell/Redistribution erlaubt mit Attribution | https://www.gov.uk/government/publications/the-uk-sanctions-list | einzelne Assets ggf. ausgenommen |
| ✅ EU Financial Sanctions (FSF/Commission) | Wiederverwendung nach **2011/833/EU** / i. d. R. **CC BY 4.0** (sofern nicht anders); Amtsblatt maßgeblich | **Ja** | Kommerziell/Redistribution unter Bedingungen; FSF kann ggü. Amtsblatt verzögert sein | https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions | Kanalabhängig prüfen |
| ✅ Canada Consolidated Autonomous Sanctions | **Open Government Licence – Canada**; Liste nur administrativ, **keine Rechtskraft** | **Ja** | Kommerziell/Redistribution mit Attribution | https://www.international.gc.ca/.../consolidated-consolide.aspx https://open.canada.ca/en/open-government-licence-canada | Regulation ist maßgeblich |
| ✅ Sanctioned Vessels (aus OFAC SDN) | wie OFAC SDN (abgeleitete Darstellung) | **OFAC/Treasury nennen** | wie OFAC; IDs mehrdeutig → nicht alleinige Compliance-Grundlage | https://sanctionslist.ofac.treas.gov/Home/SdnList | Repo-Fallback nur OFAC |
| ❗ Global Fishing Watch / Dark Vessels (AIS disabling) | Site/API: **non-commercial**-Nutzung, CC BY-NC 4.0-Kontext; **API-Token** erforderlich, vertraulich | **Ja** (GFW-Vorgaben) | **Kommerzielle API/Daten-Nutzung nicht erlaubt** unter offenen API-Terms; Rate-Limits, kein Token-Sharing | https://globalfishingwatch.org/our-apis/documentation https://globalfishingwatch.org/terms-of-use/ | kommerzielle Lizenz separat klären |
| ✅ hormuz.now (eigene Daten) | **CC BY 4.0** für hormuz.now-eigene Daten; **IMF-PortWatch-abgeleitete Daten ausgenommen** (separat lizenzieren/crediten) | **Ja** | Kommerziell/Redistribution für eigene Daten mit Attribution; API offen, kein Key, Fair-Use/Caching | https://hormuz.now/data | Mischdaten trennen |

## Energie / Wirtschaft / Infrastruktur

| Quelle | Lizenz/Terms | Attribution | Redistribution / kommerziell / API | URL | Unsicherheit |
|---|---|---|---|---|---|
| ⚠️ IMF PortWatch | IMF Copyright-and-Usage (Data): Nutzung/Verbreitung unter Bedingungen; **systematischer Bulk/LLM-Training** ohne Erlaubnis untersagt; PortWatch: kommerzielle Weiterverbreitung ggf. `copyright@imf.org` | **Ja** (IMF; PortWatch-Zitation inkl. Oxford) | Redistribution möglich, aber **kommerziell/umfangreich ggf. genehmigungspflichtig**; ArcGIS-Limits | https://portwatch.imf.org/ https://www.imf.org/en/about/copyright-and-terms | Teildatensätze (Oxford) beachten |
| ✅ EIA (Open Data API) | API Terms of Service + Copyright/Reuse; „as is“, Limits/Sperren möglich | **Ja** (EIA/US EIA), **kein Endorsement**, kein Logo ohne Genehmigung | Nutzung/Services erlaubt; Redistribution nicht als einfache CC-Lizenz formuliert — Copyright/Reuse prüfen | https://www.eia.gov/opendata/terms-of-service.php | kommerzielle Weitergabe gegen Reuse prüfen |
| ⚠️ JODI-Oil | „Freely available“ + Zitierpraxis; **keine explizite offene Datenlizenz** (kein CC/ODbL) in Terms/User Guide gefunden | **Ja** (JODI/IEF-Zitation) | **Unklar** für Redistribution/kommerziell/systematischen Abruf | https://www.jodidata.org/ https://www.jodidata.org/terms-of-use.aspx | **hoch** — vor Redistribution schriftlich klären |
| ⚠️❗ UN Comtrade | Mehrschichtig: License/Usage Agreement + Redistribution-Policy; kleine Visualisierungen teils möglich; kommerzielle API/Streaming/größere Originaldatenmengen **reguliert/gebühren- oder abo-pflichtig** | **Ja** („Source: UN Comtrade“) | **Eingeschränkt/prüfpflichtig**; <100k Originalrecords in DB kann Exemption haben (Ausnahmen beachten) | https://comtrade.un.org/licenseagreement.html https://uncomtrade.org/docs/re-dissemination-of-data/ | Use-Case-spezifisch mit UNSD klären |
| ✅ Global Energy Monitor (GEM) | **CC BY 4.0** (offizielle GEM-Lizenzseite) | **Ja** (CC BY + GEM-Zitation je Tracker/Release) | Kommerziell/Redistribution/Bearbeitung erlaubt mit Attribution | https://globalenergymonitor.org/creative-commons-license | Drittspiegel/Wiki können andere Lizenzen nennen |
| ✅ Epoch AI (Data Centers) | **CC BY** (Attribution) für Datensatz | **Ja** (Epoch AI, URL, Datum) | Kommerziell/Redistribution erlaubt mit Attribution | https://epoch.ai/data/data-centers-documentation | Versionsnummer CC BY nicht explizit; Stand/Datum dokumentieren |
| ✅ SEC EDGAR (data.sec.gov) | Öffentliche Regierungsinhalte/EDGAR-Filings **frei zugänglich und wiederverwendbar**; Fair-Access-Policy (10 req/s, User-Agent, no CORS) | empfohlen (SEC/EDGAR) | Kommerziell/Redistribution grundsätzlich möglich; technische Limits; Drittinhalte in Filings können eigene Rechte haben | https://www.sec.gov/search-filings/edgar-application-programming-interfaces https://www.sec.gov/os/webmaster-faq | eingebettete Drittmaterialien prüfen |

## Geo / Info / Militär / Satellit / Schifffahrt (ergänzend)

| Quelle | Lizenz/Terms | Attribution | Redistribution / kommerziell / API | URL | Unsicherheit |
|---|---|---|---|---|---|
| ⚠️ IODA (Georgia Tech) | **Keine klare offene Datenlizenz** gefunden; API-Software teils akademisch/nicht-kommerziell-lizenziert (nicht = Datenlizenz) | empfohlen (IODA/Georgia Tech) | **Unklar** für kommerzielle Redistribution/Massenutzung; Upstream-Signale beachten | https://ioda.inetintel.cc.gatech.edu/ | hoch |
| ⚠️ US Travel Advisories (genutzter ArcGIS-Layer) | Katalog/feed teils **CC BY**; App-Disclaimer: U.S. Gov works (17 USC §105) + Drittmaterial; **konkreter ArcGIS-Item** nicht abschließend verifiziert | **Ja** | CC-BY-Feed redistributierbar; ArcGIS-Service: Esri/Item-Bedingungen/Verfügbarkeit prüfen | https://travel.state.gov/ https://catalog.data.gov/dataset/travel-advisories | Pfadabhängig |
| ✅ UK FCDO Travel Advice (GOV.UK) | **OGL v3** (sofern nicht anders angegeben) | **Ja** | Kommerziell/Redistribution erlaubt | https://www.gov.uk/foreign-travel-advice https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | Seitenausnahmen prüfen |
| ⚠️ AU Smartraveller/DFAT | Site-Material unter „current **CC BY**“ (Ausnahmen: Logos/Coat of Arms); **downloadbare digitale Materialien** nicht kommerziell ohne DFAT-Zustimmung | **Ja** | `destinations-export`-Einordnung **unklar** (CC BY vs. Download-Restriktion); für kommerzielle Redistribution klären | https://www.smartraveller.gov.au/copyright https://www.smartraveller.gov.au/destinations-export | mittel |
| ✅ MITRE ATT&CK / CTI | ATT&CK: **lizenzgebührenfrei für Forschung/Entwicklung/kommerziell** mit Copyright-Hinweis; CTI-STIX i. d. R. **Apache 2.0** (LICENSE im Repo prüfen) | **Ja** (MITRE-Hinweis, ATT&CK® Marke) | Kommerziell/Redistribution erlaubt mit Hinweisen | https://attack.mitre.org/resources/legal-and-branding/terms-of-use/ https://github.com/mitre/cti | CTI-LICENSE direkt verifizieren |
| ❗ SIPRI (direkte Milex-DB) | **Kommerzielle Nutzung autorisieren/lizenzieren**; Fair Use nur nicht-kommerziell + <10% + weitere Bedingungen | **Ja** | **Keine freie kommerzielle Redistribution** | https://www.sipri.org/about/terms-and-conditions | Repo nutzt nur indirekt via World Bank |
| ⚠️ World Bank Open Data (SIPRI-sourced Indikatoren) | **CC BY 4.0 + WB-Zusatzbedingungen** (Streitbeilegung); Metadaten können **Drittbedingungen** auslösen | **Ja** (WB + Datenanbieter) | Grundsätzlich breit nutzbar, aber **SIPRI-Upstream**-Bedingungen in Indikator-Metadaten prüfen | https://data.worldbank.org/summary-terms-of-use | **SIPRI-Provenienz-Risiko** |
| ❗ Global Firepower | Proprietär/kuratierte Inhalte; Disclaimer: „**not for reuse in any form**“ (Footer), „as is“ | reicht nicht als Lizenz | **Scraping/Redistribution/produktive Nutzung hohes Risiko**; schriftliche Genehmigung nötig | https://www.globalfirepower.com/disclaimer.php | Quelle ersetzen/entfernen erwägen |
| ✅ NASA GIBS (Capabilities/Imagery) | NASA open data / **CC0-Leitlinie** für NASA-geführte Daten (sofern nicht anders), Acknowledgment erwartet; Layer-Metadaten prüfen (Drittanbieter) | **Ja** (GIBS/ESDIS Acknowledgment) | Kommerziell/Redistribution breit zulässig; kein Key; kein NASA-Endorsement; Dritt-Layer beachten | https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance https://nasa-gibs.github.io/gibs-api-docs/access-basics/ | layer-spezifisch prüfen |

## Gap-Liste (noch ohne klare Doku in `DATENQUELLEN.md`/`manifest.mjs`)
**Hoch/Kritisch:** OpenSky (kommerziell/operativ restriktiv, Zitatpflicht), aisstream.io (Terms unklar), GFW/Dark Vessels (NC+Token), GeoConfirmed (unklar), WarSpotting (unklar/inoffiziell), DeepStateMap (API-Genehmigung), C2IntelFeeds (**NC-SA**), UN Comtrade (Redistribution), Global Firepower (**not for reuse**), SIPRI direkt (kommerziell lizenziert), IODA (unklar), Smartraveller-Export (kommerziell unklar).

**Mittel:** WHO DON (NC-SA IGO), GDELT/UCDP Attribution+API-Token, IMF PortWatch (kommerziell klären), JODI, EIA Reuse-Details, Reisehinweise ArcGIS-Pfad, CFR GCT, GDACS, Wikimedia Commons (pro Datei), Panoramax/KartaView neben Mapillary.

**Teilweise vorhanden/ergänzen:** NASA FIRMS/EONET Zitiertext, NHC „gemeinfrei“ OK, Digitraffic marine CC BY 4.0 OK (Manifest-Key ggf. spezifizieren), Mapillary `street/` CC BY-SA in manifest OK.

## Empfohlene nächste Schritte
1. `docs/DATENQUELLEN.md` + `collectors/manifest.mjs` um neue Quellen/Lizenzen ergänzen (Attribution, NC/kommerziell, Redistribution-Hinweis).
2. **UCDP-Live-Fallback** auf tokenbasierten API-Call umstellen (`x-ucdp-access-token`).
3. Rechts-/Produktprüfung für ❗-Quellen: **C2IntelFeeds, GFW, UN Comtrade, Global Firepower, SIPRI-direkt, OpenSky operativ**; bei GeoConfirmed/WarSpotting/aisstream/IODA Terms einholen.
4. C2IntelFeeds/WHO/GFW in UI/Produktausgabe nur mit korrekter Attribution und NC-Beachtung verwenden (bzw. ersetzen).
5. `hormuz.now`-Ausgabe: IMF-PortWatch-abgeleitete Felder getrennt attribuieren.
