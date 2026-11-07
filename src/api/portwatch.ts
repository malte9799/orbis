import { snapshotJson } from './data';

export interface PortWatchPort {
  portid: string;
  portname: string;
  country?: string | null;
  ISO3?: string | null;
  continent?: string | null;
  fullname?: string | null;
  lat?: number | null;
  long?: number | null;
  vessel_count_total?: number | null;
  portclass?: string | null;
  LOCODE?: string | null;
}

export interface PortWatchChokepoint {
  portid: string;
  portname: string;
  lat?: number | null;
  lon?: number | null;
  vessel_count_total?: number | null;
}

export interface PortWatchData {
  generated: string;
  ports: PortWatchPort[];
  chokepoints: PortWatchChokepoint[];
}

const ARC = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services';

async function queryAll(service: string, layer: number, fields: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const url = `${ARC}/${service}/FeatureServer/${layer}/query?where=1%3D1&outFields=${encodeURIComponent(fields)}&returnGeometry=false&resultRecordCount=2000&resultOffset=${offset}&f=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      features?: { attributes: Record<string, unknown> }[];
      exceededTransferLimit?: boolean;
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message || 'ArcGIS error');
    const feats = data.features ?? [];
    for (const f of feats) out.push(f.attributes);
    if (!data.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
  }
  return out;
}

/** IMF PortWatch: strategic chokepoints & port scales (snapshot from orbis-data, live fallback). */
export async function loadPortWatch(): Promise<PortWatchData> {
  return snapshotJson<PortWatchData>(
    'intel/portwatch.json',
    async () => {
      const portsRaw = await queryAll('PortWatch_ports', 1, 'portid,portname,country,ISO3,continent,fullname,lat,long,vessel_count_total,portclass,LOCODE');
      const chokeRaw = await queryAll('PortWatch_chokepoints_database', 0, 'portid,portname,lat,lon,vessel_count_total');
      return {
        generated: new Date().toISOString(),
        ports: portsRaw.map((a) => ({
          portid: String(a.portid ?? ''),
          portname: String(a.portname ?? ''),
          country: (a.country as string | null) ?? null,
          ISO3: (a.ISO3 as string | null) ?? null,
          continent: (a.continent as string | null) ?? null,
          fullname: (a.fullname as string | null) ?? null,
          lat: (a.lat as number | null) ?? null,
          long: (a.long as number | null) ?? null,
          vessel_count_total: (a.vessel_count_total as number | null) ?? null,
          portclass: (a.portclass as string | null) ?? null,
          LOCODE: (a.LOCODE as string | null) ?? null,
        })),
        chokepoints: chokeRaw.map((a) => ({
          portid: String(a.portid ?? ''),
          portname: String(a.portname ?? ''),
          lat: (a.lat as number | null) ?? null,
          lon: (a.lon as number | null) ?? null,
          vessel_count_total: (a.vessel_count_total as number | null) ?? null,
        })),
      };
    },
  );
}