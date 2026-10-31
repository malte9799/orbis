import { defineProvider, type LngLat, type Route, type RouteStep } from '../types';
import { fmtLocale } from '../../i18n';
import { fetchJson } from '../../util';
import type { Maneuver } from '../types';

const MODE = { car: 'car', bike: 'bicycle', foot: 'pedestrian' } as const;

interface TtRoute {
  summary: { lengthInMeters: number; travelTimeInSeconds: number };
  legs: { points: { latitude: number; longitude: number }[] }[];
  guidance?: { instructions: { routeOffsetInMeters: number; travelTimeInSeconds: number; point: { latitude: number; longitude: number }; instructionType: string; street?: string; message?: string; maneuver: string; roundaboutExitNumber?: number }[] };
}

const man = (m: string): Maneuver => {
  const t: Record<string, Maneuver> = {
    DEPART: 'depart',
    ARRIVE: 'arrive',
    ARRIVE_LEFT: 'arrive',
    ARRIVE_RIGHT: 'arrive',
    STRAIGHT: 'straight',
    KEEP_LEFT: 'fork-left',
    BEAR_LEFT: 'slight-left',
    TURN_LEFT: 'left',
    SHARP_LEFT: 'sharp-left',
    KEEP_RIGHT: 'fork-right',
    BEAR_RIGHT: 'slight-right',
    TURN_RIGHT: 'right',
    SHARP_RIGHT: 'sharp-right',
    MAKE_UTURN: 'uturn',
    ENTER_MOTORWAY: 'ramp-right',
    ENTER_FREEWAY: 'ramp-right',
    TAKE_EXIT: 'ramp-right',
    MOTORWAY_EXIT_LEFT: 'ramp-left',
    MOTORWAY_EXIT_RIGHT: 'ramp-right',
    TAKE_FERRY: 'ferry',
    ROUNDABOUT_CROSS: 'roundabout',
    ROUNDABOUT_RIGHT: 'roundabout',
    ROUNDABOUT_LEFT: 'roundabout',
    ROUNDABOUT_BACK: 'roundabout',
  };
  return t[m] ?? 'straight';
};

export default defineProvider({
  id: 'tomtom',
  order: 50,
  label: 'TomTom Routing',
  note: 'Mit Live-Verkehr (Auto). Nutzt den TomTom-Schlüssel aus den Einstellungen.',
  key: 'tomtom',
  profiles: ['car', 'bike', 'foot'],
  available: (k) => !!k.tomtom,
  async route(req, keys) {
    const locs = req.points.map((p) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(':');
    const q = new URLSearchParams({
      key: keys.tomtom!,
      travelMode: MODE[req.profile],
      traffic: 'true',
      instructionsType: 'text',
      language: fmtLocale() === 'de-DE' ? 'de-DE' : 'en-US',
      routeRepresentation: 'polyline',
      maxAlternatives: req.alternatives ? '2' : '0',
    });
    const j = await fetchJson<{ routes?: TtRoute[] }>(`https://api.tomtom.com/routing/1/calculateRoute/${locs}/json?${q}`);
    if (!j.routes?.length) throw new Error('keine Route');
    return j.routes.map((r): Route => {
      const geometry: LngLat[] = r.legs.flatMap((l, i) => l.points.slice(i ? 1 : 0).map((p): LngLat => [p.longitude, p.latitude]));
      const ins = r.guidance?.instructions ?? [];
      const steps: RouteStep[] = ins.map((s, i) => {
        const next = ins[i + 1];
        return {
          maneuver: man(s.maneuver),
          text: (s.message ?? '').trim(),
          name: s.street ?? '',
          distance: (next ? next.routeOffsetInMeters : r.summary.lengthInMeters) - s.routeOffsetInMeters,
          duration: next ? next.travelTimeInSeconds - s.travelTimeInSeconds : 0,
          at: [s.point.longitude, s.point.latitude],
          exit: s.roundaboutExitNumber,
        };
      });
      return { provider: 'tomtom', profile: req.profile, geometry, distance: r.summary.lengthInMeters, duration: r.summary.travelTimeInSeconds, steps };
    });
  },
});
