import { defineGroup } from '../types';

export default defineGroup({
  id: 'volcanoes',
  order: 60,
  label: 'Vulkane',
  hint: 'aktive Ausbrüche (EONET, GDACS) und alle ~1.300 Vulkane (Smithsonian GVP)',
  icon: 'volcano',
  feeds: ['eonet', 'gdacs'],
  kinds: ['volcano'],
  mapLayers: ['ev-circle', 'ev-glyph'],
  linkedExtra: 'gvp',
  catalog: { label: 'Vulkane', hint: 'aktive Ausbrüche und alle ~1.300 Vulkane', color: '#ff7043', icon: 'volcano', cat: 'gefahr' },
  // the full GVP catalogue includes the currently erupting ones
  count: (ctx) => ctx.extrasCount('gvp') ?? ctx.eventCount(['volcano']),
});
