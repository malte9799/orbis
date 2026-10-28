import { defineProvider, type Route, type RouteStep } from '../types';
import { fetchJson } from '../../util';
import { decodePolyline } from '../geo';
import { fromValhalla } from '../text';

const COSTING = { car: 'auto', bike: 'bicycle', foot: 'pedestrian' } as const;

interface ValhallaTrip {
  legs: { shape: string; maneuvers: { type: number; instruction: string; length: number; time: number; begin_shape_index: number; street_names?: string[]; roundabout_exit_count?: number }[] }[];
  summary: { length: number; time: number };
}

/** one trip → route (the alternates have the same shape) */
function trip(t: ValhallaTrip, req: { profile: 'car' | 'bike' | 'foot' }): Route {
  const geometry: Route['geometry'] = [];
  const steps: RouteStep[] = [];
  t.legs.forEach((leg, li) => {
    const shape = decodePolyline(leg.shape, 6);
    const base = geometry.length ? geometry.length - 1 : 0; // the legs share their joint vertex
    for (const [i, p] of shape.entries()) if (li === 0 || i > 0) geometry.push(p);
    for (const m of leg.maneuvers) {
      const mm = fromValhalla(m.type);
      steps.push({
        maneuver: li < t.legs.length - 1 && mm === 'arrive' ? 'straight' : mm,
        text: m.instruction.replace(/\.$/, ''),
        name: m.street_names?.[0] ?? '',
        distance: m.length * 1000,
        duration: m.time,
        at: geometry[base + m.begin_shape_index] ?? shape[m.begin_shape_index],
        exit: m.roundabout_exit_count,
      });
    }
  });
  return { provider: 'valhalla', profile: req.profile, geometry, distance: t.summary.length * 1000, duration: t.summary.time, steps };
}

export default defineProvider({
  id: 'valhalla',
  order: 20,
  label: 'OpenStreetMap (Valhalla, FOSSGIS)',
  note: 'Kostenlos, ohne Schlüssel. Deutsche Ansagen vom Server, gute Rad- und Fußrouten.',
  profiles: ['car', 'bike', 'foot'],
  available: () => true,
  async route(req) {
    const json = {
      locations: req.points.map((p, i) => ({
        lon: p[0],
        lat: p[1],
        type: i === 0 || i === req.points.length - 1 ? 'break' : 'through',
        // a start with a known heading: no U-turn demanded right after a reroute
        ...(i === 0 && req.bearing != null ? { heading: Math.round(req.bearing), heading_tolerance: 60 } : {}),
      })),
      costing: COSTING[req.profile],
      directions_options: { language: 'de-DE', units: 'kilometers' },
      alternates: req.alternatives && req.points.length === 2 ? 2 : 0,
    };
    const j = await fetchJson<{ trip: ValhallaTrip; alternates?: { trip: ValhallaTrip }[] }>(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(json))}`);
    return [j.trip, ...(j.alternates ?? []).map((a) => a.trip)].map((t) => trip(t, req));
  },
});
