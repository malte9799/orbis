import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const SIPRI_ATTRIBUTION = 'SIPRI via World Bank (CC BY 4.0)';

export interface SipriExpenditureRecord {
  iso3: string;
  iso2?: string;
  name: string;
  year: number;
  /** SIPRI military expenditure in current USD (World Bank indicator MS.MIL.XPND.CD). */
  expenditureUsd: number | null;
  /** SIPRI military expenditure as % of GDP (World Bank indicator MS.MIL.XPND.GD.ZS). */
  expenditureGdpPct: number | null;
  /** True for World Bank regional/aggregate entries rather than sovereign countries. */
  isRegion?: boolean;
}

export interface SipriData {
  generated: string;
  source: string;
  sourceUrl: string;
  sourceConstraint?: string;
  indicators: Array<{ id: string; name: string; unit: string }>;
  yearRange: { from: number; to: number };
  countries: SipriExpenditureRecord[];
}

const WB_BASE = 'https://api.worldbank.org/v2/country/all/indicator';
const INDICATORS = [
  { id: 'MS.MIL.XPND.CD', name: 'Military expenditure', unit: 'current USD', key: 'expenditureUsd' as const },
  { id: 'MS.MIL.XPND.GD.ZS', name: 'Military expenditure', unit: '% of GDP', key: 'expenditureGdpPct' as const },
];

// World Bank aggregate/region ISO3 codes (not sovereign states)
const REGION_CODES = new Set([
  'AFE', 'AFW', 'ARB', 'CSS', 'CEB', 'EAR', 'EAS', 'EAP', 'TEA', 'EMU', 'ECS', 'ECA', 'TEC', 'EUU',
  'FCS', 'HPC', 'HIC', 'IBD', 'IBT', 'IDB', 'IDX', 'IDA', 'LTE', 'LCN', 'LAC', 'TLA', 'LDC', 'LMY',
  'LIC', 'LMC', 'MEA', 'MNA', 'TMN', 'MIC', 'NAC', 'OED', 'OSS', 'PSS', 'PST', 'PRE', 'SST', 'SAS',
  'TSA', 'SSF', 'SSA', 'TSS', 'UMC', 'WLD',
]);

interface WbRow {
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
}

async function fetchIndicator(id: string, from: number, to: number): Promise<WbRow[]> {
  const url = `${WB_BASE}/${id}?format=json&per_page=20000&date=${from}:${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SIPRI/World Bank HTTP ${res.status} for ${id}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || !Array.isArray(data[1])) throw new Error(`SIPRI/World Bank: unexpected response for ${id}`);
  return data[1] as WbRow[];
}

export function parseSipriFromWorldBank(usdRows: WbRow[], gdpRows: WbRow[], from: number, to: number): SipriData {
  const byKey = new Map<string, SipriExpenditureRecord>();

  const upsert = (row: WbRow) => {
    const iso3 = (row.countryiso3code ?? '').trim();
    const year = Number(row.date);
    if (!iso3 || !Number.isFinite(year)) return;
    const key = `${iso3}:${year}`;
    let rec = byKey.get(key);
    if (!rec) {
      rec = {
        iso3,
        iso2: row.country?.id?.trim() || undefined,
        name: (row.country?.value ?? '').trim(),
        year,
        expenditureUsd: null,
        expenditureGdpPct: null,
      };
      if (REGION_CODES.has(iso3)) rec.isRegion = true;
      byKey.set(key, rec);
    }
    return rec;
  };

  for (const row of usdRows) {
    const rec = upsert(row);
    if (rec) rec.expenditureUsd = typeof row.value === 'number' ? row.value : null;
  }
  for (const row of gdpRows) {
    const rec = upsert(row);
    if (rec) rec.expenditureGdpPct = typeof row.value === 'number' ? row.value : null;
  }

  const countries = [...byKey.values()]
    .filter((r) => r.expenditureUsd != null || r.expenditureGdpPct != null)
    .sort((a, b) => (a.iso3 < b.iso3 ? -1 : a.iso3 > b.iso3 ? 1 : b.year - a.year));

  if (countries.length < 50) throw new Error(`SIPRI/World Bank: only ${countries.length} records`);

  return {
    generated: new Date().toISOString(),
    source: 'SIPRI Military Expenditure Database via World Bank Open Data',
    sourceUrl: 'https://data.worldbank.org/indicator/MS.MIL.XPND.CD',
    sourceConstraint:
      'Expenditure data (USD and %GDP) sourced from World Bank indicators MS.MIL.XPND.CD / MS.MIL.XPND.GD.ZS (SIPRI-derived). SIPRI arms transfers (TIV) are not included here because no open machine-readable SIPRI endpoint was used; values may include regional aggregates (isRegion=true).',
    indicators: INDICATORS.map(({ id, name, unit }) => ({ id, name, unit })),
    yearRange: { from, to },
    countries,
  };
}

export async function fetchSipriLive(): Promise<SipriData> {
  const to = new Date().getFullYear();
  const from = Math.max(2000, to - 25);
  const [usdRows, gdpRows] = await Promise.all([
    fetchIndicator('MS.MIL.XPND.CD', from, to),
    fetchIndicator('MS.MIL.XPND.GD.ZS', from, to),
  ]);
  return parseSipriFromWorldBank(usdRows, gdpRows, from, to);
}

/** SIPRI military expenditure data from orbis-data snapshot, live fallback via World Bank (SIPRI-sourced). */
export async function loadSipri(): Promise<SipriData> {
  return snapshotJson<SipriData>('intel/sipri.json', fetchSipriLive, 120000);
}
