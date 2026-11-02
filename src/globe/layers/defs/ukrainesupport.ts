import type { Feature, LineString, Point } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { escapeHtml as esc } from '../../../util';
import { FONT_REGULAR } from '../../vector';
import { tile, category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { ukraineSupport, UKRAINE_SUPPORT_SITE, type UkraineDonor, type UkraineSupportData } from '../../../api/ukraine';

// Hilfe für die Ukraine nach Geberland (Kiel Ukraine Support Tracker, Institut für Weltwirtschaft):
// ein Bogen vom Geberland nach Kiew, Breite nach Gesamtbetrag (zugewiesene Hilfe seit 24.01.2022,
// Mrd. €). Klick auf Land oder Bogen öffnet das rechte Detail-Panel mit der Aufteilung.

const COLOR = '#f2c230';
const GLYPH: GlyphId = 'money';
const KYIV = { lat: 50.45, lon: 30.52 };

const bn = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const eur = (v: number) => `${bn.format(v)} Mrd. €`;

let cache: UkraineSupportData | null = null;

/** Punkte entlang des Großkreises zwischen zwei Orten (Grad), damit der Bogen der Kugel folgt */
function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 64): [number, number][] {
  const r = Math.PI / 180;
  const v = (c: { lat: number; lon: number }) => [Math.cos(c.lat * r) * Math.cos(c.lon * r), Math.cos(c.lat * r) * Math.sin(c.lon * r), Math.sin(c.lat * r)];
  const p = v(a);
  const q = v(b);
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = Math.sin((1 - t) * d) / Math.sin(d);
    const k2 = Math.sin(t * d) / Math.sin(d);
    const x = k1 * p[0] + k2 * q[0];
    const y = k1 * p[1] + k2 * q[1];
    const z = k1 * p[2] + k2 * q[2];
    out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.hypot(x, y)) / r]);
  }
  return out;
}

function detail(c: UkraineDonor, d: UkraineSupportData): DetailContent {
  const share = (v: number) => (c.tot ? `${Math.round((v / c.tot) * 100)} %` : '–');
  return {
    glyph: GLYPH,
    color: COLOR,
    title: c.n,
    subtitle: `Hilfe für die Ukraine · ${eur(c.tot)}`,
    body:
      `<div class="sp-tiles">${tile('Gesamt', eur(c.tot))}${tile('Militärisch', eur(c.mil))}${tile('Finanziell', eur(c.fin))}</div>` +
      category(
        'split',
        'Aufteilung (zugewiesen)',
        [
          ['Militärisch', `${eur(c.mil)} · ${share(c.mil)}`],
          ['Finanziell', `${eur(c.fin)} · ${share(c.fin)}`],
          ['Humanitär', `${eur(c.hum)} · ${share(c.hum)}`],
        ],
        new Set(['split']),
      ) +
      category(
        'q',
        'Stand und Beleg',
        [
          ['Stichtag', esc(d.asOf || '–')],
          ['Datensatz', `<a href="${esc(d.xlsx)}" target="_blank" rel="noopener noreferrer">Kiel Tracker (XLSX) ↗</a>`],
        ],
        new Set(['q']),
      ),
    source: 'Kiel Institute for the World Economy – Ukraine Support Tracker (zugewiesene Hilfe, bilateral)',
    link: { url: UKRAINE_SUPPORT_SITE, label: 'Kiel Tracker öffnen' },
  };
}

export default defineExtra({
  id: 'ukrainesupport',
  order: 706,
  section: 'politik',
  cat: 'politik',
  label: 'Ukraine: Hilfe nach Geberland',
  hint: 'Bögen von den Geberländern nach Kiew, Breite nach zugewiesener Hilfe seit 24.01.2022 (Kiel Ukraine Support Tracker): Klick zeigt Aufteilung in militärisch, finanziell und humanitär.',
  glyph: GLYPH,
  icon: 'list',
  color: COLOR,
  region: 'UA',
  sources: {
    ukrainesupport: 'Hilfe: <a href="https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/">Kiel Ukraine Support Tracker</a> (Institut für Weltwirtschaft)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('ukrainesupport', empty());
    add(
      {
        id: 'ukrainesupport',
        type: 'line',
        source: 'ukrainesupport',
        filter: ['==', ['get', 'kind'], 'arc'],
        layout: { ...hidden, 'line-cap': 'round' },
        paint: {
          'line-color': COLOR,
          'line-opacity': 0.75,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, ['+', 0.6, ['*', ['get', 'w'], 0.35]], 8, ['+', 1.2, ['*', ['get', 'w'], 0.7]]],
        },
      },
      'marker',
    );
    add(
      {
        id: 'ukrainesupport-pt',
        type: 'circle',
        source: 'ukrainesupport',
        filter: ['==', ['get', 'kind'], 'donor'],
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 5, 'circle-stroke-color': '#3a2c00', 'circle-stroke-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: 'ukrainesupport-label',
        type: 'symbol',
        source: 'ukrainesupport',
        filter: ['==', ['get', 'kind'], 'donor'],
        layout: { ...hidden, 'text-field': ['get', 'n'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#fff1b8', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ukrainesupport', 24 * 3600000, async () => {
      const d = await ukraineSupport();
      cache = d;
      const max = Math.max(...d.countries.map((c) => c.tot), 1);
      const feats: (Feature<Point> | Feature<LineString>)[] = [];
      d.countries.forEach((c, i) => {
        feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { kind: 'donor', i, n: c.n } });
        feats.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: greatCircle(c, KYIV) },
          // Breite 0–10 nach Wurzel des Gesamtbetrags, damit kleine Geber sichtbar bleiben
          properties: { kind: 'arc', i, n: c.n, w: Math.sqrt(c.tot / max) * 10 },
        });
      });
      ctx.setData('ukrainesupport', { type: 'FeatureCollection', features: feats });
      ctx.set('ukrainesupport', { count: d.countries.length, note: `zugewiesene Hilfe bis ${d.asOf || '–'} · Snapshot ${d.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const c = cache?.countries[Number(p.i)];
    if (!c || !cache) return null;
    return { type: 'detail' as const, d: detail(c, cache), lng: pt[0], lat: pt[1] };
  },
  layers: ['ukrainesupport', 'ukrainesupport-pt', 'ukrainesupport-label'],
  clickLayers: ['ukrainesupport', 'ukrainesupport-pt'],
});
