import { snapshotJson } from './data';

export interface IodaOutageEvent {
  location: string;
  start: number;
  duration: number;
  uncertainty: number | null;
  method: string;
  datasource: string;
  status: number;
  fraction: number | null;
  score: number;
  location_name: string;
  overlaps_window: boolean;
}

export interface IodaData {
  type: string;
  metadata?: { requestTime: string; responseTime: string };
  requestParameters?: Record<string, unknown>;
  error?: string | null;
  data: IodaOutageEvent[];
  copyright?: string;
}

/** IODA (Georgia Tech) internet outage events (snapshot from orbis-data, live fallback). */
export async function loadIoda(): Promise<IodaData> {
  return snapshotJson<IodaData>(
    'intel/ioda.json',
    async () => {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 24 * 3600;
      const res = await fetch(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events?from=${from}&until=${now}&limit=5000`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as IodaData;
    },
  );
}