import { snapshotJson } from './data';

export type WarSpottingStatus = 'destroyed' | 'damaged' | 'captured';

export interface WarSpottingTypeCount {
  type_name: string;
  counts: { total: string; total_new: string };
}

export interface WarSpottingStatusSummary {
  total: number;
  totalNew: number;
  counts_by_type: WarSpottingTypeCount[];
}

export interface WarSpottingTypeRow {
  type_name: string;
  destroyed: number;
  damaged: number;
  captured: number;
  total: number;
}

export interface WarSpottingData {
  generated: string;
  source?: string;
  /** Side/scope collected by the snapshot (currently Russian losses in Ukraine). */
  scope?: string;
  statuses?: Partial<Record<WarSpottingStatus, WarSpottingStatusSummary>>;
  totals?: { destroyed: number; damaged: number; captured: number; all: number };
  by_type?: WarSpottingTypeRow[];
  /** Legacy/raw destroyed breakdown retained for compatibility with older snapshots. */
  counts_by_type?: WarSpottingTypeCount[];
}

const BASE = 'https://ukr.warspotting.net/api/stats/russia';

async function fetchStatus(status: WarSpottingStatus): Promise<WarSpottingTypeCount[]> {
  const res = await fetch(`${BASE}/${status}/`, { headers: { 'User-Agent': 'Orbis/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { counts_by_type?: unknown };
  return Array.isArray(data?.counts_by_type) ? (data.counts_by_type as WarSpottingTypeCount[]) : [];
}

async function fetchWarSpottingLive(): Promise<WarSpottingData> {
  const [destroyed, damaged, captured] = await Promise.allSettled([
    fetchStatus('destroyed'),
    fetchStatus('damaged'),
    fetchStatus('captured'),
  ]);
  const pick = (r: PromiseSettledResult<WarSpottingTypeCount[]>) => (r.status === 'fulfilled' ? r.value : []);
  const statuses = {
    destroyed: pick(destroyed),
    damaged: pick(damaged),
    captured: pick(captured),
  };
  const byType = new Map<string, WarSpottingTypeRow>();
  const sum = (rows: WarSpottingTypeCount[], key: WarSpottingStatus) => {
    let total = 0;
    let totalNew = 0;
    for (const row of rows) {
      const n = Number(row.counts?.total) || 0;
      total += n;
      totalNew += Number(row.counts?.total_new) || 0;
      const agg = byType.get(row.type_name) ?? { type_name: row.type_name, destroyed: 0, damaged: 0, captured: 0, total: 0 };
      agg[key] = n;
      agg.total = agg.destroyed + agg.damaged + agg.captured;
      byType.set(row.type_name, agg);
    }
    return { total, totalNew, counts_by_type: rows };
  };
  const out = {
    destroyed: sum(statuses.destroyed, 'destroyed'),
    damaged: sum(statuses.damaged, 'damaged'),
    captured: sum(statuses.captured, 'captured'),
  };
  const totals = { destroyed: out.destroyed.total, damaged: out.damaged.total, captured: out.captured.total };
  return {
    generated: new Date().toISOString(),
    source: 'WarSpotting (ukr.warspotting.net)',
    scope: 'russia',
    statuses: out,
    totals: { ...totals, all: totals.destroyed + totals.damaged + totals.captured },
    by_type: [...byType.values()].sort((a, b) => b.total - a.total),
    counts_by_type: statuses.destroyed,
  };
}

/** WarSpotting (visually confirmed Russian equipment losses in Ukraine) from orbis-data snapshot, live fallback. */
export async function loadWarSpotting(): Promise<WarSpottingData> {
  return snapshotJson<WarSpottingData>('intel/warspotting.json', fetchWarSpottingLive, 60000);
}