import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import type { ExtraCtx } from '../types';
import type { AircraftResult } from '../../../api/tracking';

// GNSS interference (jamming/spoofing) estimated from the navigation quality that aircraft report in
// their ADS-B messages (see navQuality in api/tracking.ts). The live aircraft of every viewed area
// are collected per 0.5° cell over a rolling 30 minutes, so panning around fills the map. Cell
// formula and bands as on gpsjam.org: the first bad aircraft is discounted, then < 2 % low,
// 2–10 % medium, > 10 % high. Low values can also come from faulty avionics – an indication, no proof.
// Until enough aircraft have crossed a cell, the aircraft that report bad navigation right now are
// marked on their own (source `gnss-ac`).

const CELL_DEG = 0.5;
const WINDOW_MS = 30 * 60000;
/** cells with fewer aircraft are not shown */
const MIN_AIRCRAFT = 3;

interface Obs {
  cell: string;
  seenAt: number;
  /** last time the aircraft reported bad navigation in this cell */
  badAt: number | null;
}

type St = { obs: Map<string, Obs>; badNow: number };
const getState = (ctx: ExtraCtx) => ctx.state<St>('gnss', () => ({ obs: new Map(), badNow: 0 }));

const cellOf = (lon: number, lat: number) => `${Math.floor(lat / CELL_DEG)}:${Math.floor(lon / CELL_DEG)}`;

/** takes the aircraft of one live request into the observation store and redraws the cells */
export function feedGnss(ctx: ExtraCtx, fc: AircraftResult) {
  const st = getState(ctx);
  const now = Date.now();
  const bad: Feature<Point>[] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    if (p.navBad == null) continue;
    const [lon, lat] = p.navLon != null ? [Number(p.navLon), Number(p.navLat)] : f.geometry.coordinates;
    if (p.navBad) bad.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { lost: p.navLon != null } });
    const cell = cellOf(lon, lat);
    const key = `${p.hex}|${cell}`;
    const prev = st.obs.get(key);
    st.obs.set(key, { cell, seenAt: now, badAt: p.navBad ? now : (prev?.badAt ?? null) });
  }
  st.badNow = bad.length;
  ctx.setData('gnss-ac', { type: 'FeatureCollection', features: bad });
  renderGnss(ctx);
}

export function renderGnss(ctx: ExtraCtx) {
  const st = getState(ctx);
  const now = Date.now();
  const tally = new Map<string, { n: number; bad: number }>();
  for (const [key, o] of st.obs) {
    if (now - o.seenAt > WINDOW_MS) {
      st.obs.delete(key);
      continue;
    }
    const t = tally.get(o.cell) ?? { n: 0, bad: 0 };
    t.n++;
    if (o.badAt != null && now - o.badAt <= WINDOW_MS) t.bad++;
    tally.set(o.cell, t);
  }
  const features: Feature<Polygon>[] = [];
  let anomalies = 0;
  for (const [cell, { n, bad }] of tally) {
    if (n < MIN_AIRCRAFT) continue;
    const [r, c] = cell.split(':').map(Number);
    const s = r * CELL_DEG;
    const w = c * CELL_DEG;
    const pct = (100 * Math.max(0, bad - 1)) / n;
    const level = pct > 10 ? 'high' : pct >= 2 ? 'medium' : 'low';
    if (level !== 'low') anomalies++;
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[w, s], [w + CELL_DEG, s], [w + CELL_DEG, s + CELL_DEG], [w, s + CELL_DEG], [w, s]]] },
      properties: {
        level,
        title: level === 'high' ? 'Starke GNSS-Störung vermutet' : level === 'medium' ? 'GNSS-Störung möglich' : 'Keine Auffälligkeit',
        subtitle: `${bad} von ${n} Flugzeugen mit ungenauer Navigation (${pct.toFixed(1)} % nach Abzug eines Ausreißers) · letzte 30 min`,
        description: 'Flugzeuge melden per ADS-B, wie genau sie ihre GPS-Position kennen (NIC/NACp). Häufen sich schlechte Werte, deutet das auf Störsender oder Spoofing hin – einzelne Ausreißer können auch Gerätefehler sein.',
        source: 'adsb.lol (ODbL), Methode nach gpsjam.org',
      },
    });
  }
  const out: FeatureCollection<Polygon> = { type: 'FeatureCollection', features };
  ctx.setData('gnss', out);
  return { cells: features.length, anomalies, badNow: st.badNow };
}
