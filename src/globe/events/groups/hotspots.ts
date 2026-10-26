import { defineGroup } from '../types';

// the satellite hotspots; switched together with "fires" (no entry of its own)
export default defineGroup({
  id: 'hotspots',
  order: 20,
  label: 'Feuer-Hotspots',
  hint: 'NASA FIRMS Satellit (VIIRS)',
  icon: 'heat',
  feeds: ['firms'],
  mapLayers: ['firms', 'hotspots'],
  count: (ctx) => ctx.feed<{ count: number }>('firms').data.count || null,
  apply(ctx) {
    const firms = ctx.feed<{ ok: boolean }>('firms');
    const on = ctx.on('hotspots');
    // clickable points (own key or shared snapshot) when available, else the raster image
    ctx.vis('firms', on && firms.data.ok);
    // the coarse raster is only a fallback once the point feed has actually failed (avoids a flash of other dots)
    ctx.vis('hotspots', on && !firms.data.ok && firms.at > 0);
  },
});
