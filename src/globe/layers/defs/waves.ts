import { defineExtra } from '../types';
import { waveLabel } from '../shared/ocean';

export default defineExtra({
  id: 'waves',
  order: 200,
  section: 'ocean',
  cat: 'meer',
  label: 'Seegang & Strömung',
  hint: 'Wellenhöhe, Dünung und Meeresströmung im Kartenausschnitt – Open-Meteo Marine',
  glyph: 'tsunami',
  icon: 'wave',
  color: '#26c6da',
  sources: { waves: 'Seegang: <a href="https://open-meteo.com/en/docs/marine-weather-api">Open-Meteo Marine</a> (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'waves',
        type: 'circle',
        source: 'waves',
        layout: hidden,
        paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.8, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 8, 16], 'circle-stroke-color': 'rgba(0,0,0,0.4)', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add(waveLabel('waves-label', 'waves'), 'marker');
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['waves', 'waves-label'],
  clickLayers: ['waves'],
});
