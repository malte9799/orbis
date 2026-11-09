import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const WHO_ATTRIBUTION = 'World Health Organization, Disease Outbreak News (CC BY-NC-SA 3.0 IGO)';

export const WHO_DON_API_URL = 'https://www.who.int/api/news/diseaseoutbreaknews';
export const WHO_DON_SITE_URL = 'https://www.who.int/emergencies/disease-outbreak-news';

export interface WhoOutbreak {
  id: string;
  donId: string | null;
  title: string;
  date: string;
  url: string;
  summary: string;
}

export interface WhoOutbreaksData {
  generated: string;
  source: string;
  sourceUrl: string;
  total: number;
  items: WhoOutbreak[];
}

interface WhoDonApiItem {
  Id?: string;
  DonId?: string | null;
  Title?: string;
  PublicationDateAndTime?: string | null;
  ItemDefaultUrl?: string | null;
  Summary?: string | null;
  Overview?: string | null;
}

interface WhoDonApiResponse {
  value?: WhoDonApiItem[];
  '@odata.nextLink'?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

export function stripHtml(html: string | null | undefined, maxLen = 400): string {
  if (!html) return '';
  const text = decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h\d|tr)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

function itemUrl(path: string | null | undefined): string {
  if (!path) return WHO_DON_SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://www.who.int${path.startsWith('/') ? '' : '/'}${path}`;
}

function normalizeItem(raw: WhoDonApiItem): WhoOutbreak | null {
  const title = (raw.Title ?? '').trim();
  const date = raw.PublicationDateAndTime ?? '';
  if (!title || !date) return null;
  return {
    id: raw.Id || raw.DonId || `${date}:${title.slice(0, 40)}`,
    donId: raw.DonId?.trim() || null,
    title,
    date,
    url: itemUrl(raw.ItemDefaultUrl),
    summary: stripHtml(raw.Summary || raw.Overview),
  };
}

function buildApiUrl(top: number): string {
  const u = new URL(WHO_DON_API_URL);
  u.searchParams.set('$orderby', 'PublicationDateAndTime desc');
  u.searchParams.set('$top', String(top));
  u.searchParams.set(
    '$select',
    'Id,DonId,Title,PublicationDateAndTime,ItemDefaultUrl,Summary,Overview',
  );
  return u.toString();
}

export async function fetchWhoOutbreaksLive(limit = 150): Promise<WhoOutbreaksData> {
  const res = await fetch(buildApiUrl(limit));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as WhoDonApiResponse;
  const items = (data.value ?? [])
    .map(normalizeItem)
    .filter((x): x is WhoOutbreak => x !== null);
  if (items.length < 10) throw new Error(`WHO DON: only ${items.length} items`);
  return {
    generated: new Date().toISOString(),
    source: 'WHO Disease Outbreak News (who.int)',
    sourceUrl: WHO_DON_SITE_URL,
    total: items.length,
    items,
  };
}

/** WHO Disease Outbreak News from orbis-data snapshot, live fallback to WHO DON API. */
export async function loadWhoOutbreaks(): Promise<WhoOutbreaksData> {
  return snapshotJson<WhoOutbreaksData>('intel/who-outbreaks.json', fetchWhoOutbreaksLive, 120000);
}
