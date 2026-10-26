import { defineExtra } from '../types';

export default defineExtra({
  id: 'geology',
  order: 130,
  section: 'earth',
  cat: 'erde',
  label: 'Geologie',
  hint: 'geologische Karten weltweit, beim Zoomen immer genauer – Macrostrat',
  glyph: 'landslide',
  icon: 'mountain',
  color: '#ab47bc',
  rasters: [
      {
        id: 'geology',
        tiles: ['https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png'],
        attribution: 'Geologie: <a href="https://macrostrat.org/">Macrostrat</a> (CC BY 4.0)',
        maxzoom: 18,
        opacity: 0.65,
      },
  ],
  layers: ['geology'],
});
