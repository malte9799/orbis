import type { Feature, FeatureCollection, Point } from 'geojson';

// Seaports: the NGA World Port Index (size, depths, vessel limits, facilities) plus the UN/LOCODE
// seaports (Upply, CC BY 4.0) it does not list. Built by scripts/ports.mjs → public/data/ports.json.

/** [lon, lat, name, UN/LOCODE, country, tier, type, channel depth, pier depth, max length, max draft, pilotage, shelter, facilities]; UN/LOCODE-only ports stop after the tier */
type Row = [number, number, string, string, string, number, string?, number?, number?, number?, number?, number?, string?, string?];

export const PORT_SIZE: Record<number, string> = { 1: 'Groß', 2: 'Mittel', 3: 'Klein', 4: 'Sehr klein', 5: 'Klein (nur UN/LOCODE)' };
const TYPE: Record<string, string> = {
  'Coastal (Natural)': 'Küste, natürlich geschützt',
  'Coastal (Breakwater)': 'Küste, mit Wellenbrecher',
  'River (Natural)': 'Fluss',
  'River (Basins)': 'Fluss mit Hafenbecken',
  'River (Tide Gates)': 'Fluss mit Schleuse',
  'Coastal (Tide Gates)': 'Küste mit Schleuse',
  'Open Roadstead': 'offene Reede',
  'Canal or Lake': 'Kanal oder See',
  'Typhoon Harbor': 'Taifunhafen',
};
const SHELTER: Record<string, string> = { Excellent: 'ausgezeichnet', Good: 'gut', Fair: 'mäßig', Poor: 'schlecht', None: 'keiner' };
const FACILITY: Record<string, string> = { C: 'Container', R: 'Ro-Ro', S: 'Schüttgut', L: 'Flüssiggut', B: 'Stückgut', O: 'Öl', G: 'LNG' };

let cache: Promise<FeatureCollection<Point>> | null = null;

export function loadPorts(): Promise<FeatureCollection<Point>> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/ports.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ ports: Row[] }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(({ ports }) => ({
      type: 'FeatureCollection' as const,
      features: ports.map((r): Feature<Point> => {
        const [lon, lat, name, code, country, tier, type, channel, pier, length, draft, pilot, shelter, fac] = r;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            name,
            code,
            country: country.length === 2 ? (new Intl.DisplayNames(['de'], { type: 'region' }).of(country.toUpperCase()) ?? country) : country,
            tier,
            size: PORT_SIZE[tier],
            type: type ? (TYPE[type] ?? type) : '',
            channel: channel || '',
            pier: pier || '',
            length: length || '',
            draft: draft || '',
            pilot: pilot == null || pilot < 0 ? '' : pilot ? 'Pflicht' : 'nicht vorgeschrieben',
            shelter: shelter ? (SHELTER[shelter] ?? '') : '',
            fac: (fac ?? '')
              .split('')
              .map((c) => FACILITY[c])
              .filter(Boolean)
              .join(', '),
            wpi: type !== undefined,
          },
        };
      }),
    }))
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}
