# Plan: Flächen und Wege im OSM-Monatsauszug (zurückgestellt)

Stand: Der Lauf `scripts/cctv-heat.mjs` (Workflow `cctv-heat`, Branch `data-osm`) streamt die
Geofabrik-Extrakte mit `osmium tags-filter -R` und liefert deshalb **nur Knoten**: CCTV, Blitzer,
ALPR, OSM-Webcams, Windräder, Schächte/Stollen/Bohrlöcher (Client: `src/api/osmtiles.ts`).
Ways und Flächen mit denselben Tags fehlen im Auszug; Overpass liefert sie weiter live
(Kraftwerke `power=plant`, Steinbrüche/Bergwerke als Fläche, Pipelines, Netze, Flughäfen).

Entscheidung: Flächen und Wege vorerst weglassen. Diese Notiz hält fest, wie es später ginge.

## Warum es im Stream nicht geht
Die Geometrie von Wegen und Flächen steckt in den Knoten, die sie verbinden. Mit `-R` sind diese
Knoten weg. Osmium bräuchte zwei Durchläufe über eine Datei auf der Platte (stdin reicht nicht).

## Vorgehen (zusätzlicher Schritt, bestehender Stream bleibt)
1. Regionsdatei auf die Platte laden statt `curl | osmium` (Europa grob 30 GB; auf dem
   GitHub-Runner nur unter `/mnt`, nicht auf dem Standard-Laufwerk).
2. `osmium tags-filter` **ohne** `-R`: nimmt die referenzierten Knoten mit, Ergebnis klein.
3. `osmium export -f geojsonseq`: Linien und Flächen als fertige Geometrie.
4. Mittelpunkt bzw. Linie in dieselben 0,5°-Kacheln schreiben, Client liest über `osmtiles.ts`.

## Aufwand je Art (Einschätzung, nichts gemessen)
| Was | Aufwand | Anmerkung |
|---|---|---|
| Flächen als Mittelpunkt: Kraftwerke, Steinbrüche/Bergwerke, Rechenzentren, Webcams/ALPR auf Gebäuden | mittel | Mittelpunkt in JS, in vorhandene Sets einsortieren; Overpass könnte dort ganz entfallen. **Lohnendster Teil.** |
| Linien: Pipelines, Seekabel | mittel bis hoch | Linien an Kachelgrenzen schneiden und vereinfachen, sonst große Dateien. Seekabel laufen schon stabil auf dem `data`-Branch. |
| Relationen: Bus-/Tram-/U-Bahn-Linien | hoch | `osmium export` macht aus Routen-Relationen keine Linien; eigene Logik nötig. Eher lassen. |

## Risiken
- Plattenplatz und Laufzeit auf dem Runner, besonders Europa und Asien (Job-Timeout 180 min).
- Erst nach dem ersten echten Lauf der Knoten-Version entscheiden: `meta.json` (`points` pro
  Region) und die Laufzeiten im Log zeigen, wie viel Luft der Stream-Modus lässt.
