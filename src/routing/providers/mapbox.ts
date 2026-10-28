import { defineProvider } from '../types';
import { fetchJson } from '../../util';
import { parseOsrm, type OsrmRoute } from '../osrm';

const PROFILE = { car: 'driving-traffic', bike: 'cycling', foot: 'walking' } as const;

export default defineProvider({
  id: 'mapbox',
  order: 40,
  label: 'Mapbox Directions',
  note: 'Mit Verkehrslage (Auto). Nutzt den Mapbox-Schlüssel aus den Einstellungen.',
  key: 'mapbox',
  profiles: ['car', 'bike', 'foot'],
  available: (k) => !!k.mapbox,
  async route(req, keys) {
    const coords = req.points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
    // driving-traffic takes at most 3 coordinates
    const profile = req.profile === 'car' && req.points.length > 3 ? 'driving' : PROFILE[req.profile];
    const q = new URLSearchParams({ access_token: keys.mapbox!, geometries: 'geojson', overview: 'full', steps: 'true', language: 'de', alternatives: req.alternatives ? 'true' : 'false' });
    const j = await fetchJson<{ code: string; message?: string; routes?: OsrmRoute[] }>(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?${q}`);
    if (j.code !== 'Ok' || !j.routes?.length) throw new Error(j.message || j.code);
    return parseOsrm(j.routes, 'mapbox', req.profile, true);
  },
});
