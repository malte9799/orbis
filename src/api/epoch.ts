import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const EPOCH_ATTRIBUTION = 'Epoch AI, Frontier Data Centers (CC BY)';

export const EPOCH_DC_URL = 'https://epoch.ai/data/data_centers/data_centers.csv';

export interface EpochDc {
  name: string;
  h100Equivalents: number | null;
  powerMw: number | null;
  capitalCostB: number | null;
  owner: string;
  users: string[];
  project: string;
  chipTypes: string[];
  allChipTypes: string[];
  investors: string[];
  constructionCompanies: string[];
  energyCompanies: string[];
  country: string;
  address: string;
  sources?: string;
  calculationsSheet?: string;
}

export interface EpochDcData {
  generated: string;
  total: number;
  datacenters: EpochDc[];
}

export type EpochDataCenter = EpochDc;
export type EpochData = EpochDcData;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (c === '\r') {
      // skip carriage returns
    } else {
      field += c;
    }
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function cleanTag(s: string): string {
  return s.replace(/\s*#\w+/g, '').trim();
}

export function parseEpochDcCsv(text: string): EpochDc[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const out: EpochDc[] = [];
  for (const r of rows.slice(1)) {
    const cells = r.slice();
    while (cells.length < header.length) cells.push('');
    const get = (name: string): string => {
      const i = idx(name);
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const splitList = (name: string): string[] =>
      get(name)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const num = (name: string): number | null => {
      const v = get(name);
      if (v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const name = get('Name');
    if (!name) continue;
    out.push({
      name,
      h100Equivalents: num('Current H100 equivalents'),
      powerMw: num('Current power (MW)'),
      capitalCostB: num('Current total capital cost (2025 USD billions)'),
      owner: cleanTag(get('Owner')),
      users: splitList('Users').map(cleanTag),
      project: cleanTag(get('Project')),
      chipTypes: splitList('Current chip types'),
      allChipTypes: splitList('All chip types'),
      investors: splitList('Investors'),
      constructionCompanies: splitList('Construction companies'),
      energyCompanies: splitList('Energy companies'),
      country: get('Country'),
      address: get('Address'),
      sources: get('Selected Sources') || undefined,
      calculationsSheet: get('Calculations sheet') || undefined,
    });
  }
  return out;
}

async function fetchEpochDc(): Promise<EpochDcData> {
  const res = await fetch(EPOCH_DC_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const datacenters = parseEpochDcCsv(await res.text());
  return { generated: new Date().toISOString(), total: datacenters.length, datacenters };
}

/** Epoch AI (AI data centers) from orbis-data snapshot, live fallback to the Epoch CSV. */
export async function loadEpochDc(): Promise<EpochDcData> {
  return snapshotJson<EpochDcData>('intel/epoch-dc.json', fetchEpochDc, 120000);
}