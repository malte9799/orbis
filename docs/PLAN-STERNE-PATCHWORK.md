# Plan: Patchwork aus Detailaufnahmen in der Sterne-Ansicht (JWST, Hubble, Euclid, Chandra)

Stand: 2026-10-31 · Status: **Recherche abgeschlossen, Umsetzung offen** · Recherche-Detail: eigener
HiPS-Loader existiert bereits ([`src/space/hips.ts`](../src/space/hips.ts)), Projizierung/Lizenz geklärt

## 1. Ziel

Die Sterne-Ansicht zeigt bisher Durchmusterungs-HiPS (DSS2 + 9 Überlagerungen, bis Ordnung 11).
Darauf sollen bei starkem Hineinzoomen **die berühmten Detailaufnahmen** erscheinen – JWST, Hubble,
Euclid, Chandra. Es sind immer nur kleine Himmelsausschnitte, die zusammen ein Patchwork ergeben.

Zwei getrennte Mechanismen:

| | A) HiPS-Overlay | B) Kuratierte Pressebilder |
|---|---|---|
| Was | Footprint-HiPS anderer Archive (echte Beobachtungen, exakte Position) | Ikonische Farbaufnahmen (Presse-Komposita) als Textur-Quad |
| Positionen | im HiPS (HEALPix-Kacheln) | Katalog (RA/Dec + Winkelgröße) |
| Technik | unser HiPS-Loader, mehrfach instanziert | eigener kleiner Quad-Renderer |
| Aufwand | klein | mittel |
| Optik | einfarbig/wissenschaftlich | die bekannten „Schaukeller“ |

Empfehlung: erst A (fast gratis), dann B für die Optik.

## 2. Rechercheergebnis (2026-10-31)

Geprüft: NASA [Hubble Skymap](https://science.nasa.gov/specials/apps/hubble-skymap/)
([data.json](https://science.nasa.gov/specials/apps/hubble-skymap/data/data.json)),
[stellarium-web.org](https://stellarium-web.org) (JS-Bundle ausgewertet),
[Webb-Galerie](https://science.nasa.gov/mission/webb/multimedia/images/),
HiPS-Registrie ([26 Server](https://aladin.cds.unistra.fr/hips/list)), hipslists von
ESAC/IPAC/MPE/WFAU/NRAO/CfA/STScI abgerufen, Kacheln auf Transparenz geprüft.

| Quelle | Bildinhalt | Positionsdaten | Nutzen |
|---|---|---|---|
| Hubble Skymap | Marker-App | ✅ **342 Objekte** in offener `data.json`: Beschreibung, NASA-Link, **galaktische Koordinaten** (geprüft: Caldwell 1 = l 122,86° b +22,38°) | fertiger Objektkatalog als Patchwork-Anker (Umrechnung l/b → RA/Dec ist Standard-Rotation) |
| stellarium-web | DSS2-HiPS (CDS) + Hipparcos/Tycho/Gaia als Sternkataloge | — | bestätigt unseren Ansatz; nichts Neues |
| Webb-Galerie | hunderte Bilder, direkt ladbar (`assets.science.nasa.gov`) | ❌ keine Koordinaten | Bilder für Mechanismus B (NASA: gemeinfrei) |
| **ESAC HiPS-Server** | siehe Tabelle unten | ✅ im HiPS | Mechanismus A |

### Kandidaten für A (alle equatorial, HTTPS, CORS `*` – geprüft)

| HiPS | Ordnung | Format | Abdeckung | Anmerkung |
|---|---|---|---|---|
| `skies.esac.esa.int/JWST/NIRCam_Imaging` | 0–15 | **PNG** | 1e-5 Himmel | verifiziert: Stephan-Quintett exakt an berechneter Kachel, RGBA-Transparenz |
| `skies.esac.esa.int/JWST/MIRI_Imaging` (+ NIRISS, 2× Coronagraphic) | 0–15 | PNG | bis 7e-7 | ergänzende Instrumente |
| `cdn.skies.esac.esa.int/Q1-EDF{S,F,N}-R4-PNG-RGB_HIPS` | 0–12 | **PNG, Farbe** | ~0,3 % Himmel | Euclid-Deep-Fields Süd/Fornax/Nord – die schönsten Farb-HiPS |
| `cdaftp.cfa.harvard.edu/cxc-hips` (Chandra) | 11 | **PNG, Farbe** | 2,2 % | Röntgen-Patchwork |
| `skies.esac.esa.int/Herschel/color` | 0–8 | PNG, Farbe | „1,0“ prüfen (Füllung?) | Fern-IR-Streifen |
| `erosita.mpe.mpg.de/dr1/vo/…/eRASS1_RGB_Rate` | 0–6 | PNG | Nordhalbkugel | Röntgen |
| `skies.esac.esa.int/FermiColor` | 3 | JPEG | Vollhimmel | grob, ohne Transparenz – nur als Vollhimmel-Ebene akzeptabel |

**Nicht verwenden:** HST WFC3/ACS „live“-HiPS (Ordnung 14) – echte Beobachtungen, aber **einfarbig
mit weißem/schwarzem Hintergrund und JPEG ohne Transparenz** (am Ultra Deep Field geprüft) → würde
weiße/schwarze Rechtecke in die Karte stanzen. Gaia-DR3-RGB, AKARI, Spitzer-IRAC, Finkbeiner-Hα:
Frame `galactic` (unser Loader wirft das bewusst, siehe Schritt-A2). UKIDSS/VHS/TGSS: nur HTTP
(mixed content). VLASS: hipslist 404.

**Nebenbefund:** STScI hostet HTTPS-Spiegel von Pan-STARRS/DSS2/GALEX
(`stpubdata.s3.us-east-1.amazonaws.com/mast/skybackgrounds/…`) – freie Redundanz für den
Spiegel-Fallback (CDS ist am Recherche-Tag komplett ausgefallen: keine TCP-Verbindungen auf
`alasky`, `alaskybis`, auch nicht die CDS-Hauptseite).

## 3. Entscheidungen (Kurzfassung)

| Frage | Entscheidung |
|---|---|
| Stufe 1 | **A**: JWST NIRCam, Euclid Q1 (3 Felder), Chandra, Herschel als umschaltbare „Detailaufnahmen“-Ebene |
| Stufe 2 | **B**: Start mit ~15 ikonischen Aufnahmen (Liste unten), Bilder eingecheckt in `public/sterne/presse/` (kein Hotlinking: CORS-Garantie, keine Fremd-Abhängigkeit, Einfachheit) |
| HST „live“-HiPS | weglassen (keine Transparenz); falls später: Kacheln clientseitig nachbearbeiten (Weiß/Schwarz → Alpha) ist Qualitätsspielerei, lohnt nicht |
| Galaktische HiPS (Gaia-Karte, AKARI, Spitzer) | bleibt draußen; Frame-Rotation ist ein eigener späterer Schritt (Loader wirft heute klar – richtig so) |
| Koordinaten B | aus Hubble-Skymap-`data.json` (galaktisch → äquatorial) und OpenNGC (CC BY-SA 4.0: RA/Dec + Winkelgröße + Positionswinkel); gegen SIMBAD gegengesprüht |
| Bilder B | NASA (gemeinfrei), ESA/Webb und Euclid (CC BY-SA 3.0 IGO), ESA/Hubble (CC BY 4.0) – Attribution in `DATENQUELLEN.md` und im Bild-Panel |
| Zoom-Verhalten | Detailaufnahmen erscheinen erst unterhalb ~1° Bildschirm-FOV und blenden weich ein (wie Kachel-Fade-in); Overlays nehmen **nicht** an `minZoom` teil (Kachel-Auflösung der Durchmusterung bleibt maßgeblich) |

## 4. Technik A: HiPS-Overlay

1. **A0 Spike erledigt (2026-10-31):** CORS `access-control-allow-origin: *` auf allen ESAC-Servern
   (mit `Origin: https://malte9799.github.io` gegenprobe); JWST-Kachelinhalt an berechneter
   HEALPix-Position nachgewiesen; Euclid-Kachel RGBA mit 98 % transparentem Umfeld (leere
   Kacheln = 404 = unsichtbar – bestehendes Verhalten unseres Loaders).
2. **A1** Tabelle `DETAIL_LAYERS` in `src/views/stars.ts` (nach Vorbild `SURVEYS`): `{ id, label, url, maxOrder, renderBase, frame }`; bei `createHiPSLayer` bleibt der Frame-Guard aktiv.
3. **A2** Panel bekommt eine dritte Knopfgruppe „Detailaufnahmen“: mehrere Ebenen gleichzeitig
   umschaltbar (Checkbox-Verhalten statt Survey-Wechsel); `renderBase` dynamisch 40, 50, …
   (Überlagerungen bleiben unter den Detailaufnahmen).
4. **A3** Lade-/Fehlerverhalten wie bei Surveys (Hint-Meldung, Wiederholung per Klick,
   `cancelPending()` beim Verlassen). Detailaufnahmen-Layer nehmen **nicht** an `minZoom` teil.
5. **A4** URL-Parameter `?detail=jwst,euclid` (Mehrfachauswahl kommagetrennt).

## 5. Technik B: Kuratierte Pressebilder

1. **B1** Datendatei `src/space/patchwork.ts`: `{ id, titel, bild, ra, dec, fovDeg, pa?, quelle, lizenz, text }`.
2. **B2** Bilder per Skript `scripts/patchwork-download.mjs` (manuell kuratierte Liste, ID + URL)
   nach `public/sterne/presse/<id>.jpg` laden; WebP/JPEG ≤ 4096 px, Zielgröße ≤ ~1,5 MB/Bild.
   Skript läuft bei Bedarf lokal (kein Deploy-Workflow nötig – Bilder sind eingecheckt).
3. **B3** Renderer in der Sterne-Ansicht: Quad (4 Ecken aus Zentrum + fovDeg + Positionswinkel,
   lokale Tangentialebene reicht bei < 1° Feld) als `MeshBasicMaterial` mit Transparenz,
   `renderBase`-Ordnung; dieselbe Projektions-/Fade-Logik wie die Kacheln (himmel/kugel/karte/allsky).
4. **B4** Einblenden, wenn Bildschirm-FOV < ~4 × fovDeg; Klick → kleines Panel (Titel, Text,
   Quelle/Lizenz) – nach Vorbild des Inspektor-Panels.
5. **B5** Naht-/Projektionsbehandlung übernimmt die bestehende Projektionsklasse; Quads halten sich
   an dieselbe Konvention (Osten links) wie die Kacheln – gegen die Basiskarte abgleichen.

### Startset (Positionen vor Umsetzung gegen OpenNGC/SIMBAD prüfen)

| Aufnahme | Instrument | RA/Dec (J2000) | Größe |
|---|---|---|---|
| Cosmic Cliffs (NGC 3324) | JWST NIRCam/MIRI | 154,4° / −58,75° | ~10′ |
| Pillars of Creation (M16) | JWST NIRCam | 274,55° / −13,82° | ~7′ |
| Stephan-Quintett | JWST NIRCam/MIRI | 339,0° / +33,97° | ~10′ |
| Südlicher Ringnebel (NGC 3132) | JWST NIRCam/MIRI | 151,75° / −40,44° | ~1,5′ |
| Tarantelnebel (NGC 2070) | JWST NIRCam/MIRI | 84,68° / −69,10° | ~14′ |
| SMACS 0723 („Webb Deep Field“) | JWST NIRCam | 3,59° / −30,37° | ~2,6′ |
| Hubble Ultra Deep Field | Hubble ACS/WFC3 | 53,16° / −27,79° | 2,4′ |
| Hubble Legacy Field | Hubble | 53,0° / −27,8° | ~15′ |
| Carina-Panorama (Hubble) | Hubble ACS | ~161° / −59,7° | ~1,2° |
| Andromeda-Kern (PHAT) | Hubble | 10,68° / +41,27° | Ausschnitt |
| Sgr A* / Galaktisches Zentrum | JWST NIRCam | 266,42° / −29,01° | Ausschnitt |
| Neptune/Ring-Systeme u. a. | eher weglassen (Bewegung/zu klein) | — | — |

## 6. Lizenzen

- NASA/STScI-Bilder: gemeinfrei (NASA-Medienrichtlinie).
- ESA/Webb, Euclid (ESA/Euclid Consortium/NASA): CC BY-SA 3.0 IGO.
- ESA/Hubble: CC BY 4.0.
- Chandra (NASA/CXC/SAO): CC BY 4.0.
- Hubble-Skymap-`data.json`: NASA Goddard (Inhalte frei); Beschreibungstexte übernehmen wir nur
  mit Quellenangabe.
- Alle Quellen stehen in `docs/DATENQUELLEN.md` (Abschnitt „Sterne – Detailaufnahmen“) und im
  Bild-Panel.

## 7. Risiken / Offen

- **ESA-Server-Verfügbarkeit**: „live“-HiPS (JWST) werden on-the-fly generiert und können träge
  sein; Euclid/Chandra sind statisch. Load-Fehler dürfen den Render-Loop nie mitreißen
  (bestehendes try/catch + Hint-Meldung genügt).
- `moc_sky_fraction` von `Herschel/color` sagt „Vollhimmel“ – vermutlich mit Füllung; vor Aufnahme
  ansehen.
- Bilder B: Kuration ist Handarbeit; Scope bewusst auf ~15 Bilder begrenzt, Sammlung later erweiterbar.
- Wie bei allen Fremdquellen: nur HTTPS, `AbortSignal.timeout`, Mirror-Fallback where cheap.

## 8. Schritte

1. A1–A3 umsetzen, mit echten ESA-Servern testen (CDS-Ausfall behindert das nicht).
2. B1/B2: Startset kuratieren, Koordinaten prüfen, Skript laufen lassen, `DATENQUELLEN.md`.
3. B3–B5: Renderer + Panel + Fade, Tests (`hips.test.ts`-Vorbild: Quad-Ecken landen an
   projizierten Positionen, keine Naht-Sprünge).
4. README (Sterne-Abschnitt) + PR-Beschreibung ergänzen.
