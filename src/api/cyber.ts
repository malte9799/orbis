import { snapshotJson } from './data';

export interface CyberServer {
  ip_address: string;
  port: number;
  status: string;
  hostname?: string;
  as_number?: number;
  as_name?: string;
  country?: string;
  first_seen?: string;
  last_online?: string;
  malware?: string;
  lat?: number;
  lon?: number;
}

/** Feodo Tracker C2 servers (snapshot from orbis-data, live fallback). */
export async function loadCyberServers(): Promise<CyberServer[]> {
  return snapshotJson<CyberServer[]>(
    'cyber/feodo.json',
    async () => {
      const res = await fetch('https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as CyberServer[];
    },
  );
}