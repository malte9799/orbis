# Code-Struktur: wo trägt man was ein?

Neue Dinge sind meist **eine neue Datei** in einem Ordner; die Sammlung geschieht per `import.meta.glob`
(Dateiname = `id`, Reihenfolge über `order`). So kollidieren parallele Features nicht in gemeinsamen Listen.

| Was | Wo | Hilfsfunktion |
|---|---|---|
| Overlay-Layer (Karte) | `src/globe/layers/defs/<id>.ts` | `defineExtra` – siehe [NEUER-LAYER.md](NEUER-LAYER.md) |
| Code, den sich Layer teilen | `src/globe/layers/shared/` | – |
| Ereignis-Feed (EONET, USGS …) | `src/globe/events/feeds/<id>.ts` | `defineFeed` |
| Ereignis-Gruppe (Erdbeben, Brände …) | `src/globe/events/groups/<id>.ts` | `defineGroup` |
| Karten-Menü: Verkehr / Infrastruktur / Wetter-Familie / Wetter-Menü | `src/hud/menus/{traffic,infra,wxfamilies,wxmenu}/<id>.ts` | `defineMenuCat`, `defineWxFamily`, `defineWxMenuItem` |
| Klick-Aktion im HUD (`data-act="…"`) | `src/hud/actions/<thema>.ts` | Funktion `(core) => ({ name: (id, v, ev) => … })` |
| API-Schlüssel im Einstellungs-Panel (Gruppe, Kurzanleitung, Hinweis) | `src/settings/keys/<id>.ts` | `defineKey` |
| Einstellungs-Panel (Allgemein, Einheiten, Schlüssel) / Einheiten-Umrechnung | `src/views/settings.ts` / `src/units.ts` | – |
| Globale CSS-Regeln | `src/styles/NNN-<bereich>.css` | Nummer = Cascade-Reihenfolge |
| Daten/Geometrie der Spiele | `src/games/data.ts`, Menübilder `src/games/menu-art.ts` | – |

Das Gerüst (`ExtraLayers` in `src/globe/extras.ts`, `createGlobeView`, `createHud`) enthält keine
layer-/feed-spezifischen Listen mehr. Der Bottom-Sheet der Phone-Ansicht liegt in `src/hud/sheet.ts`.

Noch nicht zerlegt: `planetmap.ts`, die Spielabläufe in `games.ts`, Radar/Timeline/`initMap` in
`globe.ts` und `render*` in `hud.ts` (eng mit gemeinsamem Zustand verwoben).

## Routenplanung & GPS (`src/routing/`)

| Was | Wo |
|---|---|
| Routing-Dienst (Google, Valhalla, …) | `src/routing/providers/<id>.ts` – `defineProvider`; Reihenfolge über `order`, Fallback in `router.ts` |
| Schlüssel eines Dienstes | `src/settings/keys/<id>.ts` (Gruppe `routing`), Name in `provider.key` |
| GPS-Filter, Kurs (GPS + Kompass, Selbstkalibrierung) | `gps.ts` |
| Pfeil + Kamera (Folgen / Blickrichtung) | `puck.ts`, `locator.ts` |
| Fortschritt auf der Route, Abweichung, Restzeit | `guidance.ts` (rein, getestet in `routing.test.ts`) |
| Oberfläche / Ablauf | `panel.ts` / `index.ts`, Styles `src/styles/140-routing.css` |
