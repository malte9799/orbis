import type { IncidentDef, TrackPoint } from './types';
import { assetUrl } from '../assets';

export type { IncidentDef, IncidentEvent, IncidentMedia, Sample, TrackPoint } from './types';
export { sampleAt, indexAt } from './track';

// every file in ./defs is an incident (default export = defineIncident({...}))
const modules = import.meta.glob<{ default: IncidentDef }>('./defs/*.ts', { eager: true });

export const INCIDENTS: IncidentDef[] = Object.entries(modules)
  .map(([path, m]) => {
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    if (m.default.id !== file) throw new Error(`incidents/defs/${file}.ts defines '${m.default.id}' – file name and id must match`);
    return m.default;
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const incidentById = (id: string) => INCIDENTS.find((d) => d.id === id);

/** URL einer Datei unter public/ (Incident-Medien: data/incidents/…) */
export { assetUrl };

const cache = new Map<string, Promise<TrackPoint[]>>();

// Kleine Spuren liegen in src/incidents/data und stecken im Bundle ('bundle:<id>/<datei>.json'): sie kommen so mit jedem Build
// (auch Vorschauen) an, ohne dass sie erst nach R2 hochgeladen werden müssen. Große Dateien (Videos, Ton) gehören nach public/.
const bundled = import.meta.glob<{ pts: TrackPoint[] }>('./data/**/*.json', { import: 'default' });

function loadPoints(key: string, path: string): Promise<TrackPoint[]> {
  let p = cache.get(key);
  if (!p) {
    const local = path.startsWith('bundle:') ? bundled[`./data/${path.slice(7)}`] : null;
    if (path.startsWith('bundle:') && !local) return Promise.reject(new Error(`Spur ${path} fehlt`));
    p = (local ? local() : fetch(assetUrl(path)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))).then((j: { pts: TrackPoint[] }) => j.pts);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Flugspur eines Ereignisses (einmal geladen, dann im Speicher) */
export const loadTrack = (def: IncidentDef): Promise<TrackPoint[]> => loadPoints(def.id, def.track);

/** Spur des Begleitschiffs (leer, wenn das Ereignis keins hat) */
export const loadShipTrack = (def: IncidentDef): Promise<TrackPoint[]> => (def.ship ? loadPoints(`${def.id}:ship`, def.ship.track) : Promise.resolve([]));
