import { inEurope } from '../../../api/europe';
import { defineGroup, type EventFeature, type EventsCtx } from '../types';

/** In Europe EMSC is more complete (smaller quakes); elsewhere USGS. */
export function mergedQuakes(ctx: EventsCtx): EventFeature[] {
  const usgs = ctx.feed<EventFeature[]>('usgs').data;
  const emsc = ctx.feed<EventFeature[]>('emsc').data;
  return emsc.length ? [...emsc, ...usgs.filter((q) => !inEurope(q.geometry.coordinates[0], q.geometry.coordinates[1]))] : usgs;
}

export default defineGroup({
  id: 'quakes',
  order: 50,
  label: 'Erdbeben',
  hint: '7 Tage – Europa ab M1.5 (EMSC), weltweit ab M2.5 (USGS)',
  icon: 'quake',
  feeds: ['usgs', 'emsc'],
  kinds: ['quake'],
  mapLayers: ['quakes'],
  catalog: { label: 'Erdbeben', hint: '7 Tage – Europa ab M1.5, weltweit ab M2.5', color: '#ffb547', icon: 'quake', cat: 'gefahr' },
  count: (ctx) => (ctx.feed('usgs').at || ctx.feed('emsc').at ? mergedQuakes(ctx).length : null),
  sync: (ctx) => ctx.setData('quakes', mergedQuakes(ctx)),
  apply: (ctx) => ctx.vis('quakes', ctx.on('quakes')),
  listEvents: mergedQuakes,
});
