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
