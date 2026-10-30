import { defineProvider, type LngLat, type Route, type RouteStep } from '../types';
import { fetchJson } from '../../util';
import { decodePolyline } from '../geo';
import { fromGoogle } from '../text';

const MODE = { car: 'DRIVE', bike: 'BICYCLE', foot: 'WALK' } as const;

const FIELDS = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.description',
  'routes.polyline.encodedPolyline',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.startLocation',
  'routes.legs.steps.navigationInstruction',
].join(',');

interface GStep {
  distanceMeters?: number;
  staticDuration?: string;
  startLocation?: { latLng: { latitude: number; longitude: number } };
  navigationInstruction?: { maneuver?: string; instructions?: string };
}
interface GRoute {
  duration: string;
  distanceMeters: number;
  description?: string;
  polyline: { encodedPolyline: string };
  legs: { steps: GStep[] }[];
}

/** "123s" → 123 */
const secs = (d: string | undefined) => (d ? parseFloat(d) || 0 : 0);

const loc = (p: LngLat) => ({ location: { latLng: { latitude: p[1], longitude: p[0] } } });

export default defineProvider({
  id: 'google',
  order: 30,
  label: 'Google Routes',
  note: 'Mit Live-Verkehr (Auto), beste Abdeckung. Schlüssel mit „Routes API“, per HTTP-Referrer beschränken.',
  key: 'googleRoutes',
  profiles: ['car', 'bike', 'foot'],
  available: (k) => !!k.googleRoutes,
  async route(req, keys) {
    const pts = req.points;
    const body: Record<string, unknown> = {
      origin: { ...loc(pts[0]), ...(req.bearing != null && req.profile === 'car' ? { heading: Math.round(req.bearing) } : {}) },
      destination: loc(pts[pts.length - 1]),
      intermediates: pts.slice(1, -1).map(loc),
      travelMode: MODE[req.profile],
      // traffic only exists for driving
      ...(req.profile === 'car' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
      polylineQuality: 'HIGH_QUALITY',
      languageCode: 'de-DE',
      units: 'METRIC',
      computeAlternativeRoutes: req.alternatives && pts.length === 2,
    };
    const j = await fetchJson<{ routes?: GRoute[]; error?: { message?: string } }>('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': keys.googleRoutes!, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(body),
    });
    if (!j.routes?.length) throw new Error(j.error?.message || 'keine Route');
    return j.routes.map((r): Route => {
      const legs = r.legs ?? [];
      const steps: RouteStep[] = legs.flatMap((leg, li) =>
        leg.steps.map((s, si) => {
          const man = fromGoogle(s.navigationInstruction?.maneuver);
          const ll = s.startLocation?.latLng;
          // Google gives no "arrive" step: the last one of the route is made one
          return {
            maneuver: li === 0 && si === 0 && man === 'straight' ? ('depart' as const) : man,
            text: (s.navigationInstruction?.instructions ?? '').trim(),
            name: '',
            distance: s.distanceMeters ?? 0,
            duration: secs(s.staticDuration),
            at: (ll ? [ll.longitude, ll.latitude] : pts[0]) as LngLat,
          };
        }),
      );
      const last = pts[pts.length - 1];
      steps.push({ maneuver: 'arrive', text: 'Ziel erreicht', name: '', distance: 0, duration: 0, at: last });
      return {
        provider: 'google',
        profile: req.profile,
        geometry: decodePolyline(r.polyline.encodedPolyline, 5),
        distance: r.distanceMeters,
        duration: secs(r.duration),
        steps,
        summary: r.description,
      };
    });
  },
});
