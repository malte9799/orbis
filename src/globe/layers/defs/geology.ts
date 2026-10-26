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
  layers: ['geology'],
});
