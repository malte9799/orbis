import { fetchText, snapshotJson } from './data';

export interface JodiOilMonth {
  period: string;
  crudeProductionKbd: number | null;
  crudeImportsKbd: number | null;
  crudeExportsKbd: number | null;
  refineryThroughputKbd: number | null;
  crudeStocksKbbl: number | null;
  crudeStockChangeKbbl: number | null;
  productImportsKbd: number | null;
  productExportsKbd: number | null;
  totalDemandKbd: number | null;
  productStocksKbbl: number | null;
  productStockChangeKbbl: number | null;
  demandByProduct: Record<string, number | null>;
  stocksByProduct: Record<string, number | null>;
}

export interface JodiOilCountry {
  code: string;
  months: JodiOilMonth[];
}

export interface JodiOilData {
  generated: string;
  source?: string;
  total: number;
  countries: JodiOilCountry[];
}

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

function toNumber(v: string | undefined): number | null {
  const t = (v ?? '').trim();
  if (t === '' || t === '-' || t === 'x' || t === 'X' || t === '..') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function emptyMonth(period: string): JodiOilMonth {
  return {
    period,
    crudeProductionKbd: null,
    crudeImportsKbd: null,
    crudeExportsKbd: null,
    refineryThroughputKbd: null,
    crudeStocksKbbl: null,
    crudeStockChangeKbbl: null,
    productImportsKbd: null,
    productExportsKbd: null,
    totalDemandKbd: null,
    productStocksKbbl: null,
    productStockChangeKbbl: null,
    demandByProduct: {},
    stocksByProduct: {},
  };
}

/** Parse JODI-Oil primary (+ optional secondary) annual CSV text into per-country monthly series. */
export function parseJodiOilCsv(primaryCsv: string, secondaryCsv?: string): JodiOilCountry[] {
  const countries = new Map<string, Map<string, JodiOilMonth>>();

  function getMonth(code: string, period: string): JodiOilMonth {
    let cmap = countries.get(code);
    if (!cmap) {
      cmap = new Map();
      countries.set(code, cmap);
    }
    let m = cmap.get(period);
    if (!m) {
      m = emptyMonth(period);
      cmap.set(period, m);
    }
    return m;
  }

  const primaryRows = parseCsv(primaryCsv);
  if (primaryRows.length >= 2) {
    const header = primaryRows[0].map((h) => h.trim());
    const idx = (name: string) => header.indexOf(name);
    for (const r of primaryRows.slice(1)) {
      const cells = r.slice();
      while (cells.length < header.length) cells.push('');
      const code = (cells[idx('REF_AREA')] ?? '').trim();
      const period = (cells[idx('TIME_PERIOD')] ?? '').trim();
      const product = (cells[idx('ENERGY_PRODUCT')] ?? '').trim();
      const flow = (cells[idx('FLOW_BREAKDOWN')] ?? '').trim();
      const unit = (cells[idx('UNIT_MEASURE')] ?? '').trim();
      const value = toNumber(cells[idx('OBS_VALUE')]);
      if (!code || !period) continue;
      if (product !== 'TOTCRUDE') continue;
      if (unit !== 'KBD' && unit !== 'KBBL') continue;
      const m = getMonth(code, period);
      if (unit === 'KBD') {
        if (flow === 'INDPROD') m.crudeProductionKbd = value;
        else if (flow === 'TOTIMPSB') m.crudeImportsKbd = value;
        else if (flow === 'TOTEXPSB') m.crudeExportsKbd = value;
        else if (flow === 'REFINOBS') m.refineryThroughputKbd = value;
      } else {
        if (flow === 'CLOSTLV') m.crudeStocksKbbl = value;
        else if (flow === 'STOCKCH') m.crudeStockChangeKbbl = value;
      }
    }
  }

  if (secondaryCsv) {
    const secondaryRows = parseCsv(secondaryCsv);
    if (secondaryRows.length >= 2) {
      const header = secondaryRows[0].map((h) => h.trim());
      const idx = (name: string) => header.indexOf(name);
      for (const r of secondaryRows.slice(1)) {
        const cells = r.slice();
        while (cells.length < header.length) cells.push('');
        const code = (cells[idx('REF_AREA')] ?? '').trim();
        const period = (cells[idx('TIME_PERIOD')] ?? '').trim();
        const product = (cells[idx('ENERGY_PRODUCT')] ?? '').trim();
        const flow = (cells[idx('FLOW_BREAKDOWN')] ?? '').trim();
        const unit = (cells[idx('UNIT_MEASURE')] ?? '').trim();
        const value = toNumber(cells[idx('OBS_VALUE')]);
        if (!code || !period) continue;
        const m = getMonth(code, period);
        if (product === 'TOTPRODS') {
          if (unit === 'KBD') {
            if (flow === 'TOTIMPSB') m.productImportsKbd = value;
            else if (flow === 'TOTEXPSB') m.productExportsKbd = value;
            else if (flow === 'TOTDEMO') m.totalDemandKbd = value;
          } else if (unit === 'KBBL') {
            if (flow === 'CLOSTLV') m.productStocksKbbl = value;
            else if (flow === 'STOCKCH') m.productStockChangeKbbl = value;
          }
        } else {
          if (flow === 'TOTDEMO' && unit === 'KBD') m.demandByProduct[product] = value;
          else if (flow === 'CLOSTLV' && unit === 'KBBL') m.stocksByProduct[product] = value;
        }
      }
    }
  }

  const out: JodiOilCountry[] = [];
  for (const [code, periods] of countries) {
    const months = Array.from(periods.values()).sort((a, b) => a.period.localeCompare(b.period));
    out.push({ code, months });
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

export const parseJodiOil = parseJodiOilCsv;

function currentYear(): number {
  return new Date().getUTCFullYear();
}

export function jodiOilPrimaryUrl(year: number = currentYear()): string {
  const cy = currentYear();
  const file = year === cy ? `primaryyear${year}.csv` : `${year}.csv`;
  return `https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/${file}`;
}

export function jodiOilSecondaryUrl(year: number = currentYear()): string {
  const cy = currentYear();
  const file = year === cy ? `secondaryyear${year}.csv` : `${year}.csv`;
  return `https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/secondary/${file}`;
}

async function fetchTextUrl(url: string, timeoutMs = 120000): Promise<string> {
  return fetchText(url, timeoutMs);
}

async function fetchCsvWithFallback(urls: string[]): Promise<string> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fetchTextUrl(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('JODI-Oil CSV unavailable');
}

/** Live fetch of JODI-Oil annual CSVs (current year, falling back to previous year). */
export async function fetchJodiOilLive(): Promise<JodiOilData> {
  const cy = currentYear();
  const years = [cy, cy - 1];
  const [primaryText, secondaryText] = await Promise.all([
    fetchCsvWithFallback(years.map(jodiOilPrimaryUrl)),
    fetchCsvWithFallback(years.map(jodiOilSecondaryUrl)),
  ]);
  const countries = parseJodiOilCsv(primaryText, secondaryText);
  if (countries.length < 50) throw new Error(`JODI-Oil: only ${countries.length} countries`);
  return {
    generated: new Date().toISOString(),
    source: 'JODI-Oil (jodidata.org)',
    total: countries.length,
    countries,
  };
}

export const fetchJodiOil = fetchJodiOilLive;

/** JODI-Oil (oil imports, demand, stocks by country) from orbis-data snapshot, live fallback to JODI annual CSVs. */
export async function loadJodiOil(): Promise<JodiOilData> {
  return snapshotJson<JodiOilData>('intel/jodi-oil.json', fetchJodiOilLive, 120000);
}