import { defineExtra } from '../types';
import type { GlyphId } from '../../icons';
import { ensurePower, loadOsmPowerNow, applyPowerFilter } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'wind',
  order: 580,
  section: 'infra',
  cat: 'netze',
  label: 'Windkraft',
  hint: 'Windparks, beim Zoomen einzelne Anlagen',
  glyph: 'wind',
  icon: 'windmill',
  color: FUELS.Wind.color,
  sources: { power: 'Kraftwerke: <a href="https://datasets.wri.org/dataset/globalpowerplantdatabase">WRI GPPD, CC BY 4.0</a>', 'osm-power': '' },
  addLayers({ add }) {
    // points: below the event icons
    add(
      {
        id: 'power',
        type: 'circle',
        source: 'power',
        filter: ['in', ['get', 'cat'], ['literal', []]],
        layout: { 'circle-sort-key': ['get', 'mw'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['max', 1.5, ['*', 0.09, ['sqrt', ['get', 'mw']]]], 8, ['max', 3, ['*', 0.4, ['sqrt', ['get', 'mw']]]]],
          'circle-opacity': 0.85,
          'circle-stroke-color': 'rgba(0,0,0,0.45)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0, 7, 0.8],
        },
      },
      'gauges',
    );
    add(
      {
        id: 'osm-power',
        type: 'circle',
        source: 'osm-power',
        minzoom: 10,
        filter: ['in', ['get', 'cat'], ['literal', []]],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'turbine'], 3.5, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
  },
  apply: applyPowerFilter,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  click({ p, pt, html }) {
    const glyph: GlyphId = p.cat === 'wind' ? 'wind' : p.cat === 'solar' ? 'solar' : p.cat === 'hydro' ? 'hydro' : p.cat === 'nuclear' ? 'radiation' : 'plant';
    return { type: 'html', html: html(glyph, String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
