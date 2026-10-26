import { defineGroup } from '../types';

export default defineGroup({
  id: 'ice',
  order: 80,
  label: 'Eis, Schnee, Staub & Hitze',
  hint: 'Eisberge, Sandstürme – EONET',
  icon: 'ice',
  feeds: ['eonet'],
  kinds: ['ice', 'dust', 'heat', 'other'],
  mapLayers: ['ev-circle', 'ev-glyph'],
  catalog: { label: 'Eis, Staub & Hitze', hint: 'Eisberge, Sandstürme – EONET', color: '#9ec5e8', icon: 'snow', cat: 'gefahr' },
});
