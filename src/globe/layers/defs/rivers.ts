import { defineExtra } from '../types';
import { waveLabel } from '../shared/ocean';

export default defineExtra({
  id: 'rivers',
  order: 210,
  section: 'ocean',
  cat: 'meer',
  label: 'Flussabfluss & Hochwasser',
  hint: 'Abfluss in m³/s mit 7-Tage-Trend an Flüssen im Kartenausschnitt – GloFAS via Open-Meteo',
  glyph: 'flood',
  icon: 'flood',
  color: '#1e88e5',
  sources: { rivers: 'Flüsse: <a href="https://open-meteo.com/en/docs/flood-api">Open-Meteo Flood</a> / GloFAS (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'rivers',
        type: 'circle',
        source: 'rivers',
        layout: { ...hidden, 'circle-sort-key': ['get', 'q'] },
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 9, 11], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add({ ...waveLabel('rivers-label', 'rivers'), minzoom: 5 }, 'marker');
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('flood', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['rivers', 'rivers-label'],
  clickLayers: ['rivers'],
});
