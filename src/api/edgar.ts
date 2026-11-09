import { snapshotJson } from './data';

export interface EdgarFiling {
  accession: string;
  cik: string;
  company: string;
  tickers: string[];
  form: string;
  filed: string;
  period: string | null;
  location: string | null;
  items: string[];
  url: string;
}

export interface EdgarData {
  generated: string;
  source?: string;
  total: number;
  filings: EdgarFiling[];
}

export function edgarSearchUrl(days = 7, now: Date = new Date()): string {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `https://efts.sec.gov/LATEST/search-index?q=%22%22&dateRange=custom&startdt=${fmt(start)}&enddt=${fmt(end)}&size=100`;
}

export const EDGAR_SEARCH_URL = edgarSearchUrl();
export const EDGAR_ATTRIBUTION = 'U.S. SEC EDGAR (public domain)';

function parseCompany(displayName: string): { company: string; tickers: string[] } {
  let s = displayName.trim();
  const cikMatch = s.match(/\s*\(CIK\s+\d+\)\s*$/i);
  if (cikMatch && cikMatch.index !== undefined) {
    s = s.slice(0, cikMatch.index).trim();
  }
  let tickers: string[] = [];
  const tickerMatch = s.match(/\s*\(([^)]+)\)\s*$/);
  if (tickerMatch && tickerMatch.index !== undefined) {
    const inside = tickerMatch[1].trim();
    if (!/CIK/i.test(inside)) {
      tickers = inside.split(/[, ]+/).map((x) => x.trim()).filter(Boolean);
      s = s.slice(0, tickerMatch.index).trim();
    }
  }
  return { company: s, tickers };
}

export function parseEdgarFilings(json: unknown): EdgarFiling[] {
  const root = json as { hits?: { hits?: unknown[] } } | null;
  const hits = Array.isArray(root?.hits?.hits) ? root.hits.hits : [];
  const seen = new Set<string>();
  const filings: EdgarFiling[] = [];
  for (const hit of hits) {
    const h = hit as { _id?: unknown; _source?: Record<string, unknown> };
    const s = h?._source ?? {};
    const adsh = typeof s.adsh === 'string' ? s.adsh : '';
    if (!adsh || seen.has(adsh)) continue;
    const rootForms = Array.isArray(s.root_forms) ? (s.root_forms as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const form = typeof s.form === 'string' ? s.form : '';
    if (rootForms.length > 0 && !rootForms.includes(form)) continue;
    seen.add(adsh);

    const ciks = Array.isArray(s.ciks) ? (s.ciks as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const cik = ciks[0] ?? '';
    const cikNum = cik.replace(/^0+/, '') || '0';
    const displayNames = Array.isArray(s.display_names) ? (s.display_names as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const displayName = displayNames[0] ?? '';
    const { company, tickers } = parseCompany(displayName);

    const id = typeof h._id === 'string' ? h._id : '';
    const filename = id.includes(':') ? id.slice(id.indexOf(':') + 1) : '';
    const accessionPath = adsh.replace(/-/g, '');
    const url = cikNum && filename ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionPath}/${filename}` : '';

    const bizLocations = Array.isArray(s.biz_locations) ? (s.biz_locations as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const items = Array.isArray(s.items) ? (s.items as unknown[]).filter((x): x is string => typeof x === 'string') : [];

    filings.push({
      accession: adsh,
      cik,
      company,
      tickers,
      form,
      filed: typeof s.file_date === 'string' ? s.file_date : '',
      period: typeof s.period_ending === 'string' ? s.period_ending : null,
      location: bizLocations[0] ?? null,
      items,
      url,
    });
  }
  filings.sort((a, b) => b.filed.localeCompare(a.filed) || b.accession.localeCompare(a.accession));
  return filings;
}

/**
 * SEC EDGAR filings, snapshot only: SEC fair-access rules require a descriptive User-Agent, which browsers cannot set,
 * so there is no live fallback in the client (the data collector fetches it with a proper User-Agent).
 */
export async function loadEdgar(): Promise<EdgarData> {
  return snapshotJson<EdgarData>('intel/edgar.json', undefined, 60000);
}
