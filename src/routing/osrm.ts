import type { LngLat, Maneuver, Route, RouteStep, Profile } from './types';
import { fromOsrm, instruction } from './text';

/** the OSRM route JSON (also what Mapbox Directions returns) */
export interface OsrmRoute {
  distance: number;
  duration: number;
  weight_name?: string;
  geometry: { coordinates: LngLat[] };
  legs: {
    summary?: string;
    steps: {
      distance: number;
      duration: number;
      name?: string;
      ref?: string;
      geometry?: { coordinates: LngLat[] };
      maneuver: { type: string; modifier?: string; location: LngLat; instruction?: string; exit?: number };
    }[];
  }[];
}

/** OSRM answer → routes. `localText` keeps the provider's own (localised) sentence when it has one. */
export function parseOsrm(routes: OsrmRoute[], provider: string, profile: Profile, localText = false): Route[] {
  return routes.map((r) => {
    const steps: RouteStep[] = [];
    for (const leg of r.legs) {
      for (const s of leg.steps) {
        const m: Maneuver = fromOsrm(s.maneuver.type, s.maneuver.modifier);
        const name = s.name || s.ref || '';
        steps.push({
          maneuver: m,
          name,
          text: localText && s.maneuver.instruction ? s.maneuver.instruction : instruction(m, name, s.maneuver.exit),
          distance: s.distance,
          duration: s.duration,
          at: s.maneuver.location,
          exit: s.maneuver.exit,
        });
      }
    }
    // with several legs (via points) every leg ends in an "arrive" step: only the last one is the real destination
    const arrives = steps.filter((s) => s.maneuver === 'arrive');
    for (const s of arrives.slice(0, -1)) {
      s.maneuver = 'straight';
      s.text = 'Zwischenziel erreicht';
    }
    return {
      provider,
      profile,
      geometry: r.geometry.coordinates,
      distance: r.distance,
      duration: r.duration,
      steps,
      summary: r.legs.map((l) => l.summary).filter(Boolean).join(' → ') || undefined,
    };
  });
}
