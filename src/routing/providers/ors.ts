import { defineProvider, type Maneuver, type Route } from '../types';
import { fetchJson } from '../../util';

const PROFILE = { car: 'driving-car', bike: 'cycling-regular', foot: 'foot-walking' } as const;

/** ORS step `type` → manoeuvre */
const MAN: Maneuver[] = ['left', 'right', 'sharp-left', 'sharp-right', 'slight-left', 'slight-right', 'straight', 'roundabout', 'roundabout', 'uturn', 'arrive', 'depart', 'fork-left', 'fork-right'];

interface OrsFeature {
  geometry: { coordinates: [number, number][] };
  properties: {
    summary: { distance: number; duration: number };
    way_points: number[];
    segments: { steps: { distance: number; duration: number; type: number; instruction: string; name: string; way_points: [number, number]; exit_number?: number }[] }[];
  };
}

export default defineProvider({
  id: 'ors',
  order: 60,
  label: 'OpenRouteService',
  note: 'Kostenloser Schlüssel (2 000 Routen/Tag). Sehr gute Rad- und Fußprofile.',
  key: 'ors',
  profiles: ['car', 'bike', 'foot'],
  available: (k) => !!k.ors,
  async route(req, keys) {
    const body = {
      coordinates: req.points,
      language: 'de',
      instructions: true,
      units: 'm',
      ...(req.alternatives && req.points.length === 2 ? { alternative_routes: { target_count: 2, share_factor: 0.6, weight_factor: 1.6 } } : {}),
      ...(req.bearing != null ? { bearings: [[Math.round(req.bearing), 60], ...req.points.slice(1).map(() => null)] } : {}),
    };
    const j = await fetchJson<{ features?: OrsFeature[] }>(`https://api.openrouteservice.org/v2/directions/${PROFILE[req.profile]}/geojson`, {
      method: 'POST',
      headers: { Authorization: keys.ors!, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!j.features?.length) throw new Error('keine Route');
    return j.features.map((f): Route => {
      const g = f.geometry.coordinates;
      const sum = f.properties.summary;
      const wps = f.properties.segments.length;
      const steps = f.properties.segments.flatMap((seg, si) =>
        seg.steps.map((s) => {
          const m = MAN[s.type] ?? 'straight';
          return {
            maneuver: si < wps - 1 && m === 'arrive' ? ('straight' as const) : m,
            text: s.instruction,
            name: s.name === '-' ? '' : s.name,
            distance: s.distance,
            duration: s.duration,
            at: g[s.way_points[0]] as [number, number],
            exit: s.exit_number,
          };
        }),
      );
      return { provider: 'ors', profile: req.profile, geometry: g, distance: sum.distance, duration: sum.duration, steps };
    });
  },
});
