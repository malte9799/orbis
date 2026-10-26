import { defineGroup } from '../types';

export default defineGroup({
  id: 'fires',
  order: 10,
  label: 'Waldbrände',
  hint: 'NASA EONET, GDACS',
  icon: 'fire',
  feeds: ['eonet', 'gdacs'],
  kinds: ['fire'],
  mapLayers: ['firms', 'hotspots', 'ev-circle', 'ev-glyph'],
  linkedExtra: 'fireareas',
  linkedGroup: 'hotspots',
  catalog: { label: 'Feuer', hint: 'Waldbrände, Satelliten-Hotspots und Brandflächen USA', color: '#ff5722', icon: 'fire', cat: 'gefahr' },
  count(ctx) {
    const events = ctx.eventCount(['fire']);
    const areas = ctx.extrasCount('fireareas');
    return events == null && areas == null ? null : (events ?? 0) + (areas ?? 0);
  },
});
