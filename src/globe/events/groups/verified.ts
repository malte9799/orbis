import { defineGroup } from '../types';

export default defineGroup({
  id: 'verified',
  order: 25,
  label: 'Verifizierte Ereignisse',
  hint: 'GeoConfirmed (community OSINT)',
  icon: 'verified',
  feeds: ['verified'],
  kinds: ['verified'],
  mapLayers: ['ev-circle', 'ev-glyph'],
  catalog: { label: 'Verifizierte Ereignisse', hint: 'GeoConfirmed', color: '#ff9d3b', icon: 'verified', cat: 'gefahr' },
});
