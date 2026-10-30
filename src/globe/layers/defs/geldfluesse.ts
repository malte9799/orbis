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
interface Arc {
  from: string;
  to: string;
  currency: string;
  amount: number;
  lines: number;
  measure: string;
  text: string;
  sources: string[];
}
interface Data {
  credit: string;
  countries: Country[];
  arcs: Arc[];
}

const COLOR = '#ef5350';
const MONEY = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** points along the great circle between two places (degrees), so the arc follows the globe */
function greatCircle(a: Country, b: Country, steps = 64): [number, number][] {
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
    out.push([Math.atan2(y, x) / r, Math.atan2(z, Math.hypot(x, y)) / r]);
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
      geometry: { type: 'LineString', coordinates: greatCircle(f, t) },
      properties: { kind: 'arc', name: `${a.from} → ${a.to}`, currency: a.currency, amount: a.amount, lines: a.lines, measure: a.measure, text: a.text, sources: a.sources.join(' ') },
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
  hint: 'Von Land zu Land belegte Geldflüsse – Who Funded Genocide, „The Entire Network“ (CC BY 4.0)',
  glyph: 'cable',
  icon: 'cable',
  color: COLOR,
  sources: { geldfluesse: 'Geldflüsse: <a href="https://whofundedgenocide.com/map/">Who Funded Genocide – The Entire Network</a>, Research mit Wallface (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'geldfluesse-arc',
        type: 'line',
        source: 'geldfluesse',
        filter: ['==', ['get', 'kind'], 'arc'],
        layout: { ...hidden, 'line-cap': 'round' },
        paint: { 'line-color': COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2, 8, 4], 'line-opacity': 0.9 },
      },
      'marker',
    );
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
      return { count: d.arcs.length, note: 'Bogen nur, wo ein Register das Ziel nennt · Währungen werden nie addiert · Klick zeigt Quelle' };
    });
  },
  click({ p, at }) {
    if (p.kind === 'arc') {
      const sym = p.currency === 'CAD' ? 'C$' : p.currency === 'AUD' ? 'A$' : '';
      return {
        type: 'html',
        html: cardHtml({
          glyph: 'cable',
          color: COLOR,
          title: String(p.name),
          subtitle: `${sym}${MONEY.format(Number(p.amount))} ${p.currency} · ${p.lines} Zeilen`,
          description: `${String(p.text)} Ein Eintrag im Register ist keine Anschuldigung gegen die genannten Stellen.`,
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
  layers: ['geldfluesse-arc', 'geldfluesse-pt', 'geldfluesse-label'],
  clickLayers: ['geldfluesse-arc', 'geldfluesse-pt'],
});
