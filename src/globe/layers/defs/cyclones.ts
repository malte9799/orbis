import type { ExpressionSpecification } from 'maplibre-gl';
import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { escapeHtml, fmt } from '../../../util';
import { loadCyclones } from '../../../api/earth';
import { FONT_BOLD } from '../../vector';

const COLOR = '#ff7043';
const part = (p: string): ExpressionSpecification => ['==', ['get', 'part'], p];
// depression · storm · hurricane categories 1–5 (Saffir-Simpson)
const CAT_COLOR: ExpressionSpecification = ['match', ['get', 'dvlbl'], 'D', '#4fc3f7', 'S', '#ffee58', ['match', ['get', 'cat'], 1, '#ffb74d', 2, '#ff7043', 3, '#f4511e', 4, '#e53935', 5, '#ad1457', '#bdbdbd']];

const KIND: Record<string, string> = { D: 'Tropisches Tiefdruckgebiet', S: 'Tropensturm', H: 'Hurrikan', M: 'Starker Hurrikan' };

export default defineExtra({
  id: 'cyclones',
  order: 95,
  section: 'earth',
  cat: 'gefahr',
  label: 'Hurrikane (NHC)',
  hint: 'Aktuelle Stürme mit Prognosepfad und Unsicherheitskegel, Atlantik und Nordpazifik – NOAA NHC/CPHC',
  glyph: 'storm',
  icon: 'storm',
  color: COLOR,
  sources: { cyclones: 'Hurrikane: <a href="https://www.nhc.noaa.gov/">NOAA National Hurricane Center</a> / <a href="https://www.nhc.noaa.gov/?cpac">CPHC</a>' },
  addLayers({ add, hidden }) {
    // the cone: uncertainty of the centre's track (not the storm's size)
    add({ id: 'cyclones-cone', type: 'fill', source: 'cyclones', filter: part('cone'), layout: hidden, paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } }, 'lbl-border-country');
    add({ id: 'cyclones-cone-line', type: 'line', source: 'cyclones', filter: part('cone'), layout: hidden, paint: { 'line-color': '#ffffff', 'line-opacity': 0.6, 'line-width': 1, 'line-dasharray': [3, 2] } }, 'lbl-border-country');
    add({ id: 'cyclones-past', type: 'line', source: 'cyclones', filter: part('past'), layout: { ...hidden, 'line-cap': 'round' }, paint: { 'line-color': COLOR, 'line-width': 2, 'line-opacity': 0.75 } }, 'marker');
    add({ id: 'cyclones-fcst', type: 'line', source: 'cyclones', filter: part('fcst'), layout: hidden, paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-dasharray': [2, 1.5] } }, 'marker');
    add({ id: 'cyclones-pastpt', type: 'circle', source: 'cyclones', filter: part('pastpt'), minzoom: 3, layout: hidden, paint: { 'circle-color': COLOR, 'circle-radius': 2.5, 'circle-opacity': 0.8 } }, 'marker');
    add(
      {
        id: 'cyclones',
        type: 'circle',
        source: 'cyclones',
        filter: part('point'),
        layout: hidden,
        paint: {
          'circle-color': CAT_COLOR,
          'circle-radius': ['case', ['==', ['to-number', ['get', 'tau']], 0], 9, 5],
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1.2,
        },
      },
      'marker',
    );
    add(
      {
        id: 'cyclones-label',
        type: 'symbol',
        source: 'cyclones',
        filter: part('point'),
        layout: {
          ...hidden,
          // the current position carries the storm's name, the forecast points their time (from zoom 4)
          'text-field': ['step', ['zoom'], ['case', ['==', ['to-number', ['get', 'tau']], 0], ['get', 'stormname'], ''], 4, ['case', ['==', ['to-number', ['get', 'tau']], 0], ['get', 'stormname'], ['get', 'datelbl']]],
          'text-font': FONT_BOLD,
          'text-size': ['case', ['==', ['to-number', ['get', 'tau']], 0], 12, 10],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('cyclones', 15 * 60000, async () => {
      const fc = await loadCyclones();
      ctx.setData('cyclones', fc);
      const storms = new Set(fc.features.filter((f) => f.properties?.part === 'point').map((f) => f.properties?.binnumber)).size;
      return { count: storms, note: storms ? 'Kegel = Unsicherheit des Zugwegs, nicht die Sturmgröße' : 'derzeit keine Stürme im Atlantik und Nordpazifik' };
    });
  },
  click({ p, pt }) {
    const kt = Number(p.maxwind);
    const kind = KIND[String(p.dvlbl)] ?? String(p.tcdvlp ?? 'Sturm');
    const cat = Number(p.cat);
    const rows: [string, string][] = [
      ['Einstufung', `${kind}${cat ? ` · Kategorie ${cat}` : ''}`],
      ['Wind', `${fmt.num(Math.round(kt * 1.852))} km/h (${kt} kt), Böen ${fmt.num(Math.round(Number(p.gust) * 1.852))} km/h`],
      ['Luftdruck', p.mslp ? `${p.mslp} hPa` : '–'],
      ['Zeitpunkt', Number(p.tau) === 0 ? `jetzt (${p.datelbl})` : `${p.datelbl} – Prognose +${p.tau} h`],
    ];
    if (Number(p.tau) === 0 && p.tcspd != null) rows.push(['Zugrichtung', `${p.tcdir}° mit ${fmt.num(Math.round(Number(p.tcspd) * 1.609))} km/h`]);
    rows.push(['Bericht', `Nr. ${p.advisnum}, ${p.advdate}`]);
    const extra = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
    const url = String(p.basin) === 'CP' ? 'https://www.nhc.noaa.gov/?cpac' : String(p.basin) === 'EP' ? 'https://www.nhc.noaa.gov/?epac' : 'https://www.nhc.noaa.gov/?atlc';
    return { type: 'html', html: cardHtml({ glyph: 'storm', color: COLOR, title: String(p.stormname), subtitle: 'NOAA National Hurricane Center', source: 'NOAA NHC/CPHC', url, extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['cyclones-cone', 'cyclones-cone-line', 'cyclones-past', 'cyclones-fcst', 'cyclones-pastpt', 'cyclones', 'cyclones-label'],
  clickLayers: ['cyclones'],
});
