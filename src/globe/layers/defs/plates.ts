import { defineExtra } from '../types';
import { fetchJson as fetchJsonExt } from '../../../util';
import type { FeatureCollection } from 'geojson';
import { cardHtml } from '../../popup';

export default defineExtra({
  id: 'plates',
  order: 140,
  section: 'earth',
  cat: 'erde',
  label: 'Tektonische Platten',
  hint: 'Plattengrenzen (PB2002, Bird 2003)',
  glyph: 'quake',
  icon: 'quake',
  color: '#ef5350',
  sources: { plates: 'Plattengrenzen: Bird (2003), <a href="https://github.com/fraxen/tectonicplates">fraxen/tectonicplates</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'plates',
        type: 'line',
        source: 'plates',
        layout: { ...hidden, 'line-join': 'round' },
        paint: { 'line-color': '#ff5252', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 8, 3], 'line-opacity': 0.85 },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('plates', Infinity, async () => {
      const fc = await fetchJsonExt<FeatureCollection>('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json');
      ctx.setData('plates', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, at }) {
    const t = { SUB: 'Subduktionszone', OSR: 'Ozeanischer Rücken', OTF: 'Transformstörung', CRB: 'Kontinentaler Grabenbruch', CTF: 'Kontinentale Transformstörung', CCB: 'Kontinentale Kollision', OCB: 'Ozeanische Kollision' } as Record<string, string>;
    return {
      type: 'html',
      html: cardHtml({ glyph: 'quake', color: '#ef5350', title: `Plattengrenze ${String(p.Name ?? '')}`, subtitle: [p.PlateA && p.PlateB ? `${p.PlateA} – ${p.PlateB}` : '', t[String(p.Type)] ?? p.Type].filter(Boolean).join(' · '), source: 'Bird (2003), PB2002' }),
      lng: at.lng,
      lat: at.lat,
    };
  },
  layers: ['plates'],
  clickLayers: ['plates'],
});
