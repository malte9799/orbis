import { defineGroup, type NwsPolygons } from '../types';

export default defineGroup({
  id: 'tornado',
  order: 40,
  label: 'Tornados & Unwetter (USA)',
  hint: 'NWS-Warnungen, SPC-Meldungen',
  icon: 'tornado',
  feeds: ['nws', 'spc'],
  kinds: ['tornado'],
  mapLayers: ['nws-fill', 'nws-line', 'ev-circle', 'ev-glyph'],
  catalog: { label: 'Tornados & Unwetter', hint: 'NWS-Warnungen, SPC-Meldungen', color: '#b07cff', icon: 'storm', cat: 'gefahr', region: 'USA' },
  count(ctx) {
    const nws = ctx.feed<{ points: unknown[] }>('nws');
    const spc = ctx.feed<unknown[]>('spc');
    return nws.at || spc.at ? nws.data.points.length + spc.data.length : null;
  },
  sync(ctx) {
    ctx.setData('nws-poly', ctx.feed<{ polygons: NwsPolygons }>('nws').data.polygons);
  },
  apply(ctx) {
    ctx.vis('nws-fill', ctx.on('tornado'));
    ctx.vis('nws-line', ctx.on('tornado'));
  },
});
