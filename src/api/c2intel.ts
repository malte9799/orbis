import { snapshotJson } from './data';

export interface C2IntelServer {
  ip_address: string;
  /** IOC description from C2IntelFeeds (e.g. "Possible Cobaltstrike C2 IP"). */
  ioc: string;
  lat?: number | null;
  lon?: number | null;
  country?: string | null;
  as_name?: string | null;
}

const SOURCE_URL = 'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv';

function parseC2IntelCsv(csv: string): C2IntelServer[] {
  return csv
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf(',');
      const ip_address = (i >= 0 ? line.slice(0, i) : line).trim();
      const ioc = (i >= 0 ? line.slice(i + 1) : '').trim();
      return { ip_address, ioc, lat: null, lon: null, country: null, as_name: null };
    })
    .filter((d) => d.ip_address);
}

/** C2IntelFeeds verified C2 server IPs (snapshot from orbis-data, live fallback). */
export async function loadC2Intel(): Promise<C2IntelServer[]> {
  return snapshotJson<C2IntelServer[]>(
    'intel/c2intel.json',
    async () => {
      const res = await fetch(SOURCE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseC2IntelCsv(await res.text());
    },
  );
}
