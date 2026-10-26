import { defineGroup } from '../types';

export default defineGroup({
  id: 'floods',
  order: 70,
  label: 'Fluten, Dürren & Erdrutsche',
  hint: 'GDACS, EONET',
  icon: 'flood',
  feeds: ['eonet', 'gdacs'],
  kinds: ['flood', 'drought', 'landslide'],
  mapLayers: ['ev-circle', 'ev-glyph'],
  catalog: { label: 'Fluten & Dürren', hint: 'GDACS, EONET', color: '#3d9ad1', icon: 'flood', cat: 'gefahr' },
});
