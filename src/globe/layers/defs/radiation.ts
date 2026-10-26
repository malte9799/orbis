import { defineExtra } from '../types';

export default defineExtra({
  id: 'radiation',
  order: 110,
  section: 'earth',
  cat: 'gefahr',
  label: 'Radioaktivität',
  hint: 'Ortsdosisleistung – BfS (DE), EURDEP (40+ Länder, u. a. Frankreich, Türkei, Kanada), Safecast (weltweit)',
  glyph: 'radiation',
  icon: 'radiation',
  color: '#c0ca33',
  layers: ['radiation', 'radiation-label'],
  clickLayers: ['radiation'],
});
