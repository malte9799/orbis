import { defineGroup, type EonetTracks } from '../types';

export default defineGroup({
  id: 'storms',
  order: 30,
  label: 'Stürme & Zyklone',
  hint: 'mit Zugbahnen – EONET, GDACS',
  icon: 'storm',
  feeds: ['eonet', 'gdacs'],
  kinds: ['storm'],
  mapLayers: ['tracks', 'ev-circle', 'ev-glyph'],
  catalog: { label: 'Stürme & Zyklone', hint: 'mit Zugbahnen – EONET, GDACS', color: '#7c8cff', icon: 'storm', cat: 'gefahr' },
  sync(ctx) {
    ctx.setData('tracks', ctx.feed<{ tracks: EonetTracks }>('eonet').data.tracks.filter((t) => t.properties.kind === 'storm'));
  },
  apply: (ctx) => ctx.vis('tracks', ctx.on('storms')),
});
