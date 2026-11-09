import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const GEM_ATTRIBUTION = 'Global Energy Monitor (CC BY 4.0)';

export interface GemAsset {
  asset_id: string;
  location_id?: string;
  asset_name: string;
  asset_type: string;
  operating_status?: string;
  operating_sub_status?: string | null;
  capacity_value?: number | null;
  capacity_unit?: string | null;
  country?: string;
  state_province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  wiki_url?: string | null;
  url?: string;
  project_name?: string;
}

export interface GemData {
  total: number;
  assets: GemAsset[];
}

/** Global Energy Monitor assets (pipelines, storage, power plants, …) from the orbis-data snapshot, live fallback to the GEM API. */
export async function loadGem(): Promise<GemData> {
  return snapshotJson<GemData>(
    'intel/gem.json',
    async () => {
      const res = await fetch('https://api.globalenergymonitor.org/assets?limit=500');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { total?: number; results?: GemAsset[] };
      return { total: data.total ?? data.results?.length ?? 0, assets: data.results ?? [] };
    },
  );
}
