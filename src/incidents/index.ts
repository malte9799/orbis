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

/** Flugspur eines Ereignisses (einmal geladen, dann im Speicher) */
export function loadTrack(def: IncidentDef): Promise<TrackPoint[]> {
  let p = cache.get(def.id);
  if (!p) {
    p = fetch(assetUrl(def.track))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { pts: TrackPoint[] }) => j.pts);
    p.catch(() => cache.delete(def.id));
    cache.set(def.id, p);
  }
  return p;
}
