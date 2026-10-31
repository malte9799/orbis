import type { Feature, FeatureCollection, Point } from 'geojson';
import { t } from '../i18n';
import { fmtLocale } from '../i18n';

// Seaports: the NGA World Port Index (size, depths, vessel limits, facilities) plus the UN/LOCODE
// seaports (Upply, CC BY 4.0) it does not list. Built by scripts/ports.mjs → public/data/ports.json.

/** [lon, lat, name, UN/LOCODE, country, tier, type, channel depth, pier depth, max length, max draft, pilotage, shelter, facilities]; UN/LOCODE-only ports stop after the tier */
type Row = [number, number, string, string, string, number, string?, number?, number?, number?, number?, number?, string?, string?];

export const PORT_SIZE: Record<number, string> = { 1: t('map.port.size.1'), 2: t('map.port.size.2'), 3: t('map.port.size.3'), 4: t('map.port.size.4'), 5: t('map.port.size.5') };
const TYPE: Record<string, string> = {
  'Coastal (Natural)': t('map.port.type.coastalNatural'),
  'Coastal (Breakwater)': t('map.port.type.coastalBreakwater'),
  'River (Natural)': t('map.port.type.riverNatural'),
  'River (Basins)': t('map.port.type.riverBasins'),
  'River (Tide Gates)': t('map.port.type.riverTide'),
  'Coastal (Tide Gates)': t('map.port.type.coastalTide'),
  'Open Roadstead': t('map.port.type.roadstead'),
  'Canal or Lake': t('map.port.type.canalLake'),
  'Typhoon Harbor': t('map.port.type.typhoon'),
};
const SHELTER: Record<string, string> = { Excellent: t('map.port.shelter.Excellent'), Good: t('map.port.shelter.Good'), Fair: t('map.port.shelter.Fair'), Poor: t('map.port.shelter.Poor'), None: t('map.port.shelter.None') };
const FACILITY: Record<string, string> = { C: t('map.port.facility.C'), R: t('map.port.facility.R'), S: t('map.port.facility.S'), L: t('map.port.facility.L'), B: t('map.port.facility.B'), O: t('map.port.facility.O'), G: t('map.port.facility.G') };

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
            country: country.length === 2 ? (new Intl.DisplayNames([fmtLocale()], { type: 'region' }).of(country.toUpperCase()) ?? country) : country,
            tier,
            size: PORT_SIZE[tier],
            type: type ? (TYPE[type] ?? type) : '',
            channel: channel || '',
            pier: pier || '',
            length: length || '',
            draft: draft || '',
            pilot: pilot == null || pilot < 0 ? '' : pilot ? t('map.port.pilot') : t('map.port.pilotNo'),
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
