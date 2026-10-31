# i18n – Orbis (de · en)

Kleines eigenes Runtime-Modul **ohne Abhängigkeiten**. Deutsch (`de`) ist die
Quelle der Wahrheit, `en` liegt daneben. Kein Framework, kein i18next –
siehe `index.ts` (~100 Zeilen).

## Dateien

| Pfad | Zweck |
|---|---|
| `src/i18n/index.ts` | Runtime: `t()`, `getLang()`, `setLang()`, `fmtLocale()`, `onLangChange()` |
| `src/i18n/locales/de/<bereich>.json` | Deutsche Kataloge, **ein Namespace-Objekt pro Datei** |
| `src/i18n/locales/en/<bereich>.json` | Englische Kataloge, gleiche Dateinamen |
| `scripts/i18n-check.mjs` | Key-Parität + Placeholder-Check, läuft in `pnpm typecheck`/`build` |
| `src/i18n/index.test.ts` | Vitest-Tests |

**Katalog-Aufteilung (Feature-Grenzen, bitte nicht durchmischen):**

| Datei | Namespaces | Inhalt |
|---|---|---|
| `app.json` | `common.*`, `settings.*` | App-Grundgerüst/Einstellungen (Phase 0) |
| `forecast.json` | `forecast.*`, `wx.*`, `units.*`, `chart.*` | Vorhersage (Phase 1) |
| `map.json` | `map.*`, `layers.*`, `hud.*`, `nav.*`, `routing.*` | Karte/HUD/Layer (Phase 2) |
| `misc.json` | `space.*`, `games.*`, `fahrplan.*`, `inspector.*` | Rest (Phase 3) |

API-Schlüssel-Texte (`keys.*`, Tipps/Walkthroughs) gehören in Phase 3 zu `misc.json`.

## API

```ts
import { t, getLang, setLang, fmtLocale, onLangChange, type Lang } from '../i18n';

t('common.retry')                       // "Erneut versuchen" / "Try again"
t('forecast.updated', { at: stamp })    // {param}-Interpolation
t('app.items', { count: n }, n)         // Plural: { "one": "…", "other": "… {count} …" }
fmtLocale()                             // 'de-DE' | 'en'  → Intl.toLocaleString/DisplayNames
setLang('en')                           // persistiert + <html lang> + Event; View rendert neu/reload
```

## Regeln für Übersetzer-Arbeit (Phasen 1–3)

1. **Ganze Sätze statt verklebter Fragmente.** Deutsche Wortbausteine
   (`… Uhr`, `ü. NN`, `· Bft`, `Stand … – …`) werden zu **einer** Message mit
   `{param}`-Tokens verschmolzen, nicht Wort für Wort getauscht.
2. **Plurals** als Objekt-Blatt `{ "one": "…", "other": "…" }`, Zähler immer
   `{count}`. Für de/en genügen one/other.
3. **Namenskonflikt `t`:** In vielen Dateien ist `t` bereits als lokale Variable
   belegt (z. B. `globe.ts:1063`, Click-Handler in `views/*.ts`). Dann den
   Alias importieren: `import { t as m } from '../i18n';`
4. **Nicht übersetzen** (bleibt unangetastet, auch nicht in die Kataloge):
   Quellen-/Lizenz-Attributionen (`sources:` in `globe/layers/defs/*.ts`),
   Copernicus-/ECMWF-Legaltext, Eigennamen (Planeten, Monde, Formationen,
   Ortsnamen), IDs/Routen (`#/vorhersage`, Store-Keys, Layer-IDs).
5. **API-Sprache:** Alle `language: 'de'`-Parameter (openmeteo, connections,
   routing/providers/*) lesen `getLang()` bzw. `fmtLocale()` – niemals wieder
   `'de'` festnageln.
6. **Immer de + en gleichzeitig füllen.** `pnpm typecheck` schlägt an, wenn
   `en` gegen `de` versetzt ist; `t()` fällt ansonsten auf `de` zurück.
7. **Umschalten** lädt die Seite neu (`setLang` + `location.reload()` in
   `views/settings.ts`); Views, die live mitschalten wollen, nutzen
   `onLangChange`.
8. **Einheiten & Zahlen:** Bezugs-Locale für Zahlen/Daten ist `fmtLocale()`
   statt `'de-DE'` (siehe `units.ts`/`util.ts`). Übersetzbare Einheiten-Wörter
   („Knoten“, „Meilen“, „Seemeilen“) wandern als `units.*`-Keys in
   `forecast.json`; der Einheiten-Suffix aus den Nummern-Formaten bleibt
   technisch.
