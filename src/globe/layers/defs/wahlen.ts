// Ebene „Wahlen": färbt Gebiete nach der Sieger-Partei – Deutschland im Start (Bundestags- und
// Landtagswahlen seit 1990, gerda-Snapshot). Der Zeitstrahl (Views) zeigt einen Schritt pro
// Wahltermin; jedes Gebiet zeigt das Ergebnis seiner letzten Wahl vor dem gewählten Termin.
// Klick öffnet das rechte Panel (src/globe/wahlenpanel.ts) mit allen Parteien und Stimmen.
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { defineExtra, type ClickCtx, type ExtraCtx } from '../types';
import type { ClickResult } from '../../extras';
import { empty } from '../shared/geo';
import type { GlyphId } from '../../icons';
import {
  loadWahlen,
  subscribeWahlen,
  wahlenResultAt,
  wahlenAnchorLabel,
  partyColor,
  winnerOf,
} from '../../../api/wahlen';

const COLOR = '#a626a4';
const GLYPH: GlyphId = 'vote';
const NO_DATA = '#4a5158';
const SOURCE =
  'Bundestagswahlen: <a href="https://german-elections.com">GERDA – German Election Database</a> (CC BY 4.0); ' +
  'Landtagswahlen: © <a href="https://www.regionalstatistik.de">Statistische Ämter des Bundes und der Länder</a> (<a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>, via GERDA, auf Länder aggregiert); ' +
  'Grenzen: © GeoBasis-DE / <a href="https://www.bkg.bund.de">BKG</a> (2026) (<a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>, vereinfacht)';

/** Karten-Features mit Siegerfarbe; `k` (ISO-Gebietscode) verbindet Eigenschaften und Daten */
function features(geo: FeatureCollection<Geometry> | null): Feature<Geometry, { k: string; n: string; c?: string; w?: string }>[] {
  if (!geo) return [];
  return geo.features.map((f) => {
    const props = f.properties as { k?: string; n?: string };
    const k = props.k ?? '';
    const res = wahlenResultAt(k);
    const w = res ? winnerOf(res) : null;
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: { k, n: props.n ?? '', c: w ? partyColor(w[0]) : NO_DATA, w: w?.[0] ?? '' },
    };
  });
}

const renders = new Map<ExtraCtx, () => void>();

function render(ctx: ExtraCtx, geo: FeatureCollection<Geometry> | null) {
  const feats = features(geo);
  ctx.setData('wahlen', { type: 'FeatureCollection', features: feats });
  ctx.set('wahlen', { count: feats.length, note: wahlenAnchorLabel() || undefined });
}

export default defineExtra({
  id: 'wahlen',
  order: 720,
  section: 'politik',
  cat: 'politik',
  label: 'Wahlergebnisse',
  hint: 'Historische Wahlergebnisse seit 1990: Gebiete färben sich nach der Partei mit den meisten gültigen Stimmen, der Zeitstrahl springt Wahltermin für Wahltermin. Klick öffnet das Seitenpanel mit allen Parteien und Stimmen.',
  glyph: GLYPH,
  icon: 'vote',
  color: COLOR,
  region: 'DE',
  sources: { wahlen: SOURCE },
  addLayers(ctx) {
    ctx.setData('wahlen', empty());
    ctx.add(
      {
        id: 'wahlen-fill',
        type: 'fill',
        source: 'wahlen',
        minzoom: 1,
        layout: ctx.hidden,
        paint: {
          'fill-color': ['coalesce', ['get', 'c'], NO_DATA] as never,
          'fill-opacity': 0.72,
        },
      },
      'lbl-border-country',
    );
    ctx.add(
      {
        id: 'wahlen-line',
        type: 'line',
        source: 'wahlen',
        layout: { ...ctx.hidden, 'line-join': 'round' },
        paint: {
          'line-color': 'rgba(255,255,255,0.45)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 1.4],
        },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('wahlen', Infinity, async () => {
      const d = await loadWahlen();
      if (d) render(ctx, d.geo);
      return {};
    });
    // Änderungen der Auswahl (Chips, Zeitstrahl) zeichnen neu
    if (!renders.has(ctx)) {
      let geo: FeatureCollection<Geometry> | null = null;
      const fn = () => {
        if (ctx.isOn('wahlen') && geo) render(ctx, geo);
      };
      renders.set(ctx, fn);
      const off = subscribeWahlen(fn);
      void loadWahlen()
        .then((d) => {
          geo = d?.geo ?? null;
          if (ctx.isOn('wahlen') && geo) render(ctx, geo);
        })
        .catch(() => off()); // ohne Daten kein Neuzeichnen
    }
  },
  disable(ctx) {
    renders.delete(ctx);
  },
  click({ p, at }: ClickCtx): ClickResult | null {
    const k = String(p.k ?? '');
    if (!k || !wahlenResultAt(k)) return null;
    return { type: 'wahlen', region: k, lng: at.lng, lat: at.lat };
  },
  layers: ['wahlen-fill', 'wahlen-line'],
  clickLayers: ['wahlen-fill'],
});
