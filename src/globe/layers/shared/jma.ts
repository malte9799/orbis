import type { RasterTileSource } from 'maplibre-gl';
import type { ExtraCtx } from '../types';
import { JMA_RADAR_TILES } from './tiles';

/** Point a JMA source at its newest scan (observation) or the +60 min forecast frame (nowcast). */
export async function loadJmaRadar(ctx: ExtraCtx, id: 'jmaradar' | 'jmanowcast' = 'jmaradar') {
  const nowcast = id === 'jmanowcast';
  const r = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_${nowcast ? 'N2' : 'N1'}.json`);
  if (!r.ok) throw new Error(`JMA ${r.status}`);
  const times = (await r.json()) as { basetime: string; validtime: string }[];
  const latest = nowcast ? times.reduce((a, t) => (t.basetime > a.basetime || (t.basetime === a.basetime && t.validtime > a.validtime) ? t : a), times[0]) : (times.find((t) => t.basetime === t.validtime) ?? times[0]);
  if (!latest) throw new Error('JMA: keine Radarzeit');
  (ctx.map.getSource(id) as RasterTileSource | undefined)?.setTiles([JMA_RADAR_TILES(latest.basetime, latest.validtime)]);
}
