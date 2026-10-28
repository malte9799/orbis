import { defineProvider } from '../types';
import { fetchJson } from '../../util';
import { parseOsrm, type OsrmRoute } from '../osrm';

const PATH = { car: 'routed-car', bike: 'routed-bike', foot: 'routed-foot' } as const;

export default defineProvider({
  id: 'fossgis',
  order: 10,
  label: 'OpenStreetMap (OSRM, FOSSGIS)',
  note: 'Kostenlos, ohne Schlüssel. Auto, Rad und Fuß auf OpenStreetMap-Daten.',
  profiles: ['car', 'bike', 'foot'],
  available: () => true,
  async route(req) {
    const coords = req.points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
    const q = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true', alternatives: req.alternatives ? 'true' : 'false' });
    const j = await fetchJson<{ code: string; message?: string; routes?: OsrmRoute[] }>(`https://routing.openstreetmap.de/${PATH[req.profile]}/route/v1/driving/${coords}?${q}`);
    if (j.code !== 'Ok' || !j.routes?.length) throw new Error(j.message || j.code);
    return parseOsrm(j.routes, 'fossgis', req.profile);
  },
});
