import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { loadAqhi } from '../../../api/earth';
import { FONT_BOLD } from '../../vector';

const COLOR = '#26a69a';

/** AQHI health risk bands (Environment Canada): 1–3 low, 4–6 moderate, 7–10 high, above very high */
const risk = (v: number) => (v > 10 ? 'sehr hohes Risiko' : v >= 7 ? 'hohes Risiko' : v >= 4 ? 'mittleres Risiko' : 'geringes Risiko');

export default defineExtra({
  id: 'aqhi',
  order: 52,
  section: 'earth',
  cat: 'wetter',
  label: 'Luftqualität Kanada (Messstationen)',
  hint: 'Air Quality Health Index, stündlich gemessen – Environment and Climate Change Canada',
  glyph: 'air',
  icon: 'air',
  color: COLOR,
  region: 'CA',
  sources: { aqhi: 'Luftqualität: © <a href="https://eccc-msc.github.io/open-data/">Environment and Climate Change Canada</a> (Open Government Licence – Canada)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'aqhi',
        type: 'circle',
        source: 'aqhi',
        layout: hidden,
        paint: {
          'circle-color': ['step', ['get', 'aqhi'], '#43a047', 4, '#fdd835', 7, '#fb8c00', 10.5, '#c62828'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 9],
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'aqhi-label',
        type: 'symbol',
        source: 'aqhi',
        minzoom: 4,
        layout: { ...hidden, 'text-field': ['number-format', ['get', 'aqhi'], { 'max-fraction-digits': 0 }], 'text-font': FONT_BOLD, 'text-size': 10, 'text-allow-overlap': true },
        paint: { 'text-color': '#000000' },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('aqhi', 30 * 60000, async () => {
      const fc = await loadAqhi();
      ctx.setData('aqhi', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, pt }) {
    const v = Number(p.aqhi);
    return { type: 'html', html: cardHtml({ glyph: 'air', color: COLOR, title: String(p.name), subtitle: `AQHI ${Math.round(v)} – ${risk(v)}`, date: p.date, source: 'Environment and Climate Change Canada', url: 'https://weather.gc.ca/airquality/pages/index_e.html' }), lng: pt[0], lat: pt[1] };
  },
  layers: ['aqhi', 'aqhi-label'],
  clickLayers: ['aqhi'],
});
