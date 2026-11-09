import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const WARWATCH_ATTRIBUTION = 'War Watch (warwatch.ch, CC BY 4.0)';

export const WAR_WATCH_URL = 'https://warwatch.ch/wp-json/warwatch/v1/all-map-data';

export interface WarWatchParty {
  id: number;
  name: string;
  slug?: string;
}

export interface WarWatchConflict {
  id: number;
  title: string;
  short_title?: string;
  slug?: string;
  anchor_id?: string;
  types: string[];
  has_non_state_parties?: boolean;
  non_state_parties?: WarWatchParty[];
  state_parties?: WarWatchParty[];
  coalitions?: { id: number; name: string }[];
  is_ended?: boolean;
  is_future?: boolean;
  is_active?: boolean;
  is_new?: boolean;
  counts_toward_total?: boolean;
  status_start_label?: string;
  status_end_label?: string;
}

export interface WarWatchSituation {
  id: number;
  lineage_root_id?: number;
  title: string;
  url: string;
  forthcoming?: boolean;
  temporal_inactive?: boolean;
  parties?: string;
  total_conflicts?: number;
  conflict_types?: string[];
  conflicts: WarWatchConflict[];
  violations?: { icon: string; url: string; name: string; subtab: string }[];
}

export interface WarWatchCountryData {
  code: string;
  conflict_types: string[];
  has_non_state_parties: boolean;
  situations: WarWatchSituation[];
  temporal_inactive?: boolean;
  total_conflicts?: number;
}

export interface WarWatchMapData {
  countries: (number | string)[];
  countries_data: Record<string, WarWatchCountryData>;
  conflict_counts: Record<string, number>;
  iac_total: number;
  unique_conflicts_count: number;
  year: number;
  total_situations: number;
  state_actor_countries: (number | string)[];
  state_actor_involvement: Record<string, unknown>;
  spillover_groups: unknown[];
}

export interface WarWatchGeography {
  regions?: unknown[];
  subregions?: unknown[];
  countries?: unknown[];
}

export interface WarWatchData {
  generated: string;
  map_data: WarWatchMapData;
  geography?: WarWatchGeography;
  state_parties?: WarWatchParty[];
  non_state_parties?: WarWatchParty[];
  coalitions?: { id: number; name: string }[];
  cached_at?: number;
  generation_time?: string;
}

async function fetchWarWatchLive(): Promise<WarWatchData> {
  const res = await fetch(WAR_WATCH_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Omit<WarWatchData, 'generated'>;
  return { generated: new Date().toISOString(), ...data };
}

/** War Watch (classification of armed conflicts per IHL) from orbis-data snapshot, live fallback. */
export async function loadWarWatch(): Promise<WarWatchData> {
  return snapshotJson<WarWatchData>('intel/warwatch.json', fetchWarWatchLive, 120000);
}