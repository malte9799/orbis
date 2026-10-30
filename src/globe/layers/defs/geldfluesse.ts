import type { FeatureCollection } from 'geojson';
import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { FONT_REGULAR } from '../../vector';
import { escapeHtml, fetchJson } from '../../../util';

interface Country {
  name: string;
  lat: number;
  lon: number;
  notes: string[];
}
type Cls = 'money' | 'ordered' | 'ceiling' | 'structure';
interface Arc {
  from: string;
  to: string;
  cls: Cls;
  amounts?: { currency: string; amount: number }[];
  lines: number;
  label: string;
  text: string;
  sources: string[];
}
interface Data {
  credit: string;
  countries: Country[];
  arcs: Arc[];
}

const COLOR = '#ef5350';
// colours and bulge of the arc classes (the board's own line classes); the bulge keeps arcs between the same two countries apart
const CLASS: Record<Cls, { color: string; bulge: number; label: string; dash?: number[] }> = {
  money: { color: '#ffd54f', bulge: 0, label: 'Geld, laut Register geflossen' },
  ordered: { color: '#ffb74d', bulge: 2.5, label: 'Bestellt oder beauftragt', dash: [3, 2] },
  ceiling: { color: '#ba8f45', bulge: -2.5, label: 'Genehmigte Obergrenze (Maximum)', dash: [0.6, 2] },
  structure: { color: '#90a4ae', bulge: 5, label: 'Nationale Sektion, kein Geld', dash: [0.6, 2] },
};
const SYMBOL: Record<string, string> = { CAD: 'C$', AUD: 'A$', GBP: '£', USD: '$', ILS: '₪' };
const MONEY = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** points along the great circle between two places (degrees), so the arc follows the globe */
function greatCircle(a: Country, b: Country, bulge: number, steps = 64): [number, number][] {
  const r = Math.PI / 180;
  const v = (c: Country) => [Math.cos(c.lat * r) * Math.cos(c.lon * r), Math.cos(c.lat * r) * Math.sin(c.lon * r), Math.sin(c.lat * r)];
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
    // sideways shift (degrees), largest in the middle
    const w = Math.sin(Math.PI * t) * bulge;
    const lon = Math.atan2(y, x) / r;
    const lat = Math.atan2(z, Math.hypot(x, y)) / r;
    out.push([lon + w * Math.sign(b.lat - a.lat || 1), lat + w * Math.sign(a.lon - b.lon || 1)]);
  }
  return out;
}

function toGeoJson(d: Data): FeatureCollection {
  const by = new Map(d.countries.map((c) => [c.name, c]));
  const features: FeatureCollection['features'] = d.countries.map((c) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
    properties: { kind: 'country', name: c.name, notes: c.notes.join('\n') },
  }));
  for (const a of d.arcs) {
    const f = by.get(a.from);
    const t = by.get(a.to);
    if (!f || !t) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: greatCircle(f, t, CLASS[a.cls].bulge) },
      properties: { kind: 'arc', cls: a.cls, name: `${a.from} → ${a.to}`, amounts: JSON.stringify(a.amounts ?? []), lines: a.lines, label: a.label, text: a.text, sources: a.sources.join(' ') },
    });
  }
  return { type: 'FeatureCollection', features };
}

export default defineExtra({
  id: 'geldfluesse',
  order: 570,
  section: 'networks',
  cat: 'netze',
  label: 'Geldflüsse',
  hint: 'Bögen von Land zu Land: Geld laut Registern, Bestellungen, Obergrenzen, Sektionen – Who Funded Genocide (CC BY 4.0)',
  glyph: 'cable',
  icon: 'cable',
  color: COLOR,
  sources: { geldfluesse: 'Geldflüsse: <a href="https://whofundedgenocide.com/map/">Who Funded Genocide – The Entire Network</a>, Research mit Wallface (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    for (const [cls, c] of Object.entries(CLASS)) {
      add(
        {
          id: `geldfluesse-${cls}`,
          type: 'line',
          source: 'geldfluesse',
          filter: ['all', ['==', ['get', 'kind'], 'arc'], ['==', ['get', 'cls'], cls]],
          layout: { ...hidden, 'line-cap': c.dash ? 'butt' : 'round' },
          paint: { 'line-color': c.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 8, 4], 'line-opacity': 0.9, ...(c.dash ? { 'line-dasharray': c.dash } : {}) },
        },
        'marker',
      );
    }
    add(
      {
        id: 'geldfluesse-pt',
        type: 'circle',
        source: 'geldfluesse',
        filter: ['==', ['get', 'kind'], 'country'],
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 5, 'circle-stroke-color': '#1b0000', 'circle-stroke-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: 'geldfluesse-label',
        type: 'symbol',
        source: 'geldfluesse',
        filter: ['==', ['get', 'kind'], 'country'],
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffcdd2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('geldfluesse', Infinity, async () => {
      const d = await fetchJson<Data>(`${import.meta.env.BASE_URL}data/geldfluesse.json`);
      ctx.setData('geldfluesse', toGeoJson(d));
      return { count: d.arcs.length, note: 'Durchgezogen: Geld · gestrichelt: bestellt · gepunktet: Obergrenze / kein Geld · Währungen werden nie addiert' };
    });
  },
  click({ p, at }) {
    if (p.kind === 'arc') {
      const amounts = JSON.parse(String(p.amounts)) as { currency: string; amount: number }[];
      const c = CLASS[p.cls as Cls];
      return {
        type: 'html',
        html: cardHtml({
          glyph: 'cable',
          color: c.color,
          title: String(p.name),
          subtitle: [c.label, ...amounts.map((m) => `${SYMBOL[m.currency] ?? ''}${MONEY.format(m.amount)} ${m.currency}`), `${p.lines} Zeilen`].join(' · '),
          description: `${String(p.text)} Ein Registereintrag ist keine Anschuldigung gegen die genannten Stellen; eine Obergrenze ist kein ausgegebenes Geld.`,
          source: `Who Funded Genocide, „The Entire Network“ (CC BY 4.0) · ${String(p.sources)}`,
          url: 'https://whofundedgenocide.com/map/',
        }),
        lng: at.lng,
        lat: at.lat,
      };
    }
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'cable',
        color: COLOR,
        title: String(p.name),
        extra: `<ul class="pop-desc">${String(p.notes).split('\n').map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`,
        source: 'Who Funded Genocide, „The Entire Network“ (CC BY 4.0)',
        url: 'https://whofundedgenocide.com/map/',
      }),
      lng: at.lng,
      lat: at.lat,
    };
  },
  layers: [...Object.keys(CLASS).map((c) => `geldfluesse-${c}`), 'geldfluesse-pt', 'geldfluesse-label'],
  clickLayers: [...Object.keys(CLASS).map((c) => `geldfluesse-${c}`), 'geldfluesse-pt'],
});
