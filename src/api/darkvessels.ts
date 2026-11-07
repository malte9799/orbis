import { snapshotJson } from './data';

export interface DarkVesselEvent {
  id: string;
  ssvid?: string;
  vesselName?: string;
  vesselFlag?: string;
  vesselType?: string;
  lat?: number;
  lon?: number;
  gapStart?: string;
  gapEnd?: string;
  gapHours?: number;
  regions?: string[];
}

export interface DarkVesselsData {
  generated: string;
  source: string;
  sourceConstraint?: string;
  events: DarkVesselEvent[];
}

/** Dark vessel / AIS disabling ("going dark") events from orbis-data snapshot. */
export async function loadDarkVessels(): Promise<DarkVesselsData> {
  return snapshotJson<DarkVesselsData>('intel/dark-vessels.json', async () => ({
    generated: new Date().toISOString(),
    source: 'placeholder',
    sourceConstraint:
      'No live keyless AIS-gap source configured; using snapshot/placeholder data.',
    events: [],
  }));
}
