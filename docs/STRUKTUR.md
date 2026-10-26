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
| API-Schlüssel im Einstellungsdialog | `src/settings/keys/<id>.ts` | `defineKey` |
| Globale CSS-Regeln | `src/styles/NNN-<bereich>.css` | Nummer = Cascade-Reihenfolge |
| Daten/Geometrie der Spiele | `src/games/data.ts`, Menübilder `src/games/menu-art.ts` | – |

Das Gerüst (`ExtraLayers` in `src/globe/extras.ts`, `createGlobeView`, `createHud`) enthält keine
layer-/feed-spezifischen Listen mehr. Der Bottom-Sheet der Phone-Ansicht liegt in `src/hud/sheet.ts`.

Noch nicht zerlegt: `planetmap.ts`, die Spielabläufe in `games.ts`, Radar/Timeline/`initMap` in
`globe.ts` und `render*` in `hud.ts` (eng mit gemeinsamem Zustand verwoben).
