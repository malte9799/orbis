import { defineExtra } from '../types';
import { loadAutobahn } from '../../../api/transit';

export default defineExtra({
  id: 'autobahn',
  order: 530,
  section: 'infra',
  cat: 'verkehr',
  label: 'Autobahn: Staus & Baustellen',
  hint: 'Verkehrsmeldungen, Sperrungen, Baustellen – Autobahn GmbH',
  glyph: 'warn',
  icon: 'car',
  color: '#ffa000',
  region: 'DE',
  sources: { autobahn: 'Verkehr: <a href="https://www.autobahn.de/">Autobahn GmbH</a>', 'autobahn-line': '' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'autobahn-line',
        type: 'line',
        source: 'autobahn-line',
        minzoom: 6,
        layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 12, 6], 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'autobahn',
        type: 'circle',
        source: 'autobahn',
        minzoom: 5,
        layout: { ...hidden, 'circle-sort-key': ['match', ['get', 'kind'], 'closure', 3, 'jam', 2, 'warning', 1, 0] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'kind'], 'roadworks', 2, 3], 11, ['match', ['get', 'kind'], 'roadworks', 5, 7]],
          'circle-stroke-color': ['match', ['get', 'kind'], 'closure', '#ffffff', 'rgba(0,0,0,0.6)'],
          'circle-stroke-width': 1.2,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('autobahn', 10 * 60000, async () => {
      // Reports surface as their roads finish loading – the first sweep takes a while
      // (the feed has no spatial query, so every road has to be visited), later
      // sweeps are revalidated cheaply from the browser cache.
      const r = await loadAutobahn((p) => {
        ctx.setData('autobahn', { type: 'FeatureCollection', features: p.points });
        ctx.setData('autobahn-line', { type: 'FeatureCollection', features: p.lines });
      });
      ctx.setData('autobahn', r.points);
      ctx.setData('autobahn-line', r.lines);
      const n = (k: string) => r.points.features.filter((f) => f.properties?.kind === k).length;
      return { count: r.points.features.length, note: `${n('jam')} Staus · ${n('closure')} Sperrungen · ${n('roadworks')} Baustellen` };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('warn', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['autobahn-line', 'autobahn'],
  clickLayers: ['autobahn'],
});
