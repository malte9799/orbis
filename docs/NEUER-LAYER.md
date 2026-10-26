# Neuen Overlay-Layer anlegen

Metadaten eines Layers (Name, Hinweis, Farbe, Icon, Kategorie, Karten-Layer-IDs, Klick-Layer) stehen
in **einer eigenen Datei** `src/globe/layers/defs/<id>.ts` – kopiere eine bestehende, z. B. `tides.ts`:

```ts
export default defineExtra({
  id: 'tides',          // = Dateiname
  order: 1000,          // Position in den Menüs, Lücken lassen
  section: 'ocean',     // Gruppe in der Ebenen-Liste
  cat: 'meer',          // Kategorie im Karten-Katalog
  label: '…', hint: '…', glyph: 'gauge', icon: 'wave', color: '#42a5f5',
  layers: ['tides'],    // alle Map-Layer, die mit dem Layer an/aus gehen
  clickLayers: ['tides'],
});
```

`ExtraId`, `EXTRAS`, `LAYERS`, `EXTRA_CLICK_LAYERS` und der Katalog werden daraus abgeleitet
(`import.meta.glob`), es muss keine gemeinsame Liste mehr angefasst werden. Die Logik (Quellen,
Map-Layer, Laden, Klick) steckt noch in `src/globe/extras.ts`.

## Layer mit eigener Logik

`defineExtra` nimmt außerdem optional entgegen (siehe `src/globe/layers/types.ts`):

- `rasters`: Raster-Overlays (Kachel-URL, Attribution, Zoom, Deckkraft, `bounds`) – komplett deklarativ
- `sources`: leere GeoJSON-Quellen, die der Layer besitzt (`id → Attribution`)
- `addLayers(ctx)`: legt die Map-Layer an (`ctx.add`, `ctx.hidden`)
- `enable(ctx)`: wird bei jedem `apply()` aufgerufen, solange der Layer an ist (`ctx.loadOnce`, `ctx.setData`)
- `click(c)`: Popup für einen Klick auf einen der `clickLayers`
- `onMoveEnd(ctx)`: nach dem Verschieben der Karte, solange der Layer an ist
- `ctx.state(key, init)`: Zustand pro Karte (nicht modulglobal, es können mehrere Karten laufen); dazu `ctx.viewBounds`, `ctx.set`, `ctx.info`

Beispiele: `tides.ts` (alles), `radio.ts` (mit Zustand), `plates.ts`, `ndvi.ts` (nur Raster). Layer mit viel Zustand
(Flugzeuge, Schiffe, Blitze …) hängen noch an der Klasse in `extras.ts`.

## Aufbau

- `src/globe/layers/defs/<id>.ts` – ein Layer pro Datei (Metadaten + Logik)
- `src/globe/layers/shared/` – Code, den sich mehrere Layer teilen (`power`, `sats`, `air`, `ships`, `vehicles`, `cams`, `tiles` …)
- `src/globe/layers/index.ts` – sammelt die Defs (`import.meta.glob`), leitet `EXTRAS`, `LAYERS`, `EXTRA_CLICK_LAYERS`, `CLICK_HANDLERS` ab
- `src/globe/extras.ts` – nur noch das Gerüst (`ExtraLayers`: Ein-/Ausschalten, Deckkraft, Timer, Klick-Weiterleitung) und die öffentliche API für die Views

Beispiele: `tides.ts` (alles in einer Datei), `radio.ts` (mit Zustand pro Karte), `ndvi.ts` (nur Raster),
`aircraft.ts` + `shared/air.ts` (großes Feature mit öffentlicher API, die `ExtraLayers` weiterreicht).

Hinweise:
- Zustand gehört in `ctx.state(...)`, nicht in Modulvariablen (es können mehrere Karten laufen).
- Eine Quelle (`source`), die ein Layer-Spec benutzt, muss in `sources`/`rasters` des Moduls stehen
  (sonst wirft MapLibre beim Start „source not found“).
- Die Stapelreihenfolge richtet sich nach `order`.
