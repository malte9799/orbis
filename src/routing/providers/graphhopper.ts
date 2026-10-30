import { defineProvider, type Maneuver, type Route } from '../types';
import { fetchJson } from '../../util';

const PROFILE = { car: 'car', bike: 'bike', foot: 'foot' } as const;

/** GraphHopper instruction `sign` → manoeuvre */
const man = (s: number): Maneuver => {
  switch (s) {
    case -98:
      return 'uturn';
    case -8:
      return 'uturn';
    case -3:
      return 'sharp-left';
    case -2:
      return 'left';
    case -1:
      return 'slight-left';
    case 1:
      return 'slight-right';
    case 2:
      return 'right';
    case 3:
      return 'sharp-right';
    case 4:
      return 'arrive';
    case 5:
      return 'straight'; // via point
    case 6:
      return 'roundabout';
    case 7:
      return 'fork-right';
    case -7:
      return 'fork-left';
    default:
      return 'straight';
  }
};

interface GhPath {
  distance: number;
  time: number;
  points: { coordinates: [number, number][] };
  instructions: { text: string; street_name: string; distance: number; time: number; sign: number; interval: [number, number]; exit_number?: number }[];
}

export default defineProvider({
  id: 'graphhopper',
  order: 70,
  label: 'GraphHopper',
  note: 'Kostenloser Schlüssel (500 Routen/Tag). Deutsche Ansagen.',
  key: 'graphhopper',
  profiles: ['car', 'bike', 'foot'],
  available: (k) => !!k.graphhopper,
  async route(req, keys) {
    const body = {
      points: req.points,
      profile: PROFILE[req.profile],
      locale: 'de',
      instructions: true,
      points_encoded: false,
      calc_points: true,
      ...(req.alternatives && req.points.length === 2 ? { algorithm: 'alternative_route', 'alternative_route.max_paths': 3 } : {}),
    };
    const j = await fetchJson<{ paths?: GhPath[]; message?: string }>(`https://graphhopper.com/api/1/route?key=${encodeURIComponent(keys.graphhopper!)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!j.paths?.length) throw new Error(j.message || 'keine Route');
    return j.paths.map((p): Route => {
      const g = p.points.coordinates;
      return {
        provider: 'graphhopper',
        profile: req.profile,
        geometry: g,
        distance: p.distance,
        duration: p.time / 1000,
        steps: p.instructions.map((s) => ({
          maneuver: man(s.sign),
          text: s.text,
          name: s.street_name,
          distance: s.distance,
          duration: s.time / 1000,
          at: g[s.interval[0]],
          exit: s.exit_number,
        })),
      };
    });
  },
});
