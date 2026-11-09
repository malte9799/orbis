import { snapshotJson } from './data';

export interface TravelAdvisory {
  source: 'US' | 'UK';
  country: string;
  iso2?: string;
  iso3?: string;
  level?: number | string | string[] | null;
  levelText?: string;
  url?: string;
  updated?: string;
  summary?: string;
  region?: string;
}

export interface TravelAdvisories {
  generated?: string;
  us: TravelAdvisory[];
  uk: TravelAdvisory[];
}

const US_LEVELS: Record<number, string> = {
  1: 'Exercise Normal Precautions',
  2: 'Exercise Increased Caution',
  3: 'Reconsider Travel',
  4: 'Do Not Travel',
  10: 'Exercise Normal Precautions – Contains Areas with Higher Security Risk',
  20: 'Exercise Increased Caution – Contains Areas with Higher Security Risk',
  30: 'Reconsider Travel – Contains Areas with Higher Security Risk',
};

async function fetchUs(): Promise<TravelAdvisory[]> {
  const base = 'https://services6.arcgis.com/R6wlO6UHmSzqm9Vs/arcgis/rest/services/Travel_Advisory_Levels__(2024)_View_Layer/FeatureServer/54/query';
  const out: TravelAdvisory[] = [];
  let offset = 0;
  while (true) {
    const url = `${base}?where=${encodeURIComponent('NAME IS NOT NULL')}&outFields=*&f=json&returnGeometry=false&resultRecordCount=1000&resultOffset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      features?: { attributes: Record<string, unknown> }[];
      exceededTransferLimit?: boolean;
    };
    const feats = data.features ?? [];
    for (const f of feats) {
      const a = f.attributes ?? {};
      if (!a.NAME) continue;
      const level = (a.LEVEL_ as number | null) ?? null;
      out.push({
        source: 'US',
        country: String(a.NAME),
        iso3: (a.ISO_3 as string | null) ?? undefined,
        level,
        levelText: level != null ? (US_LEVELS[level] ?? String(level)) : undefined,
        url: (a.URL as string | null) ?? undefined,
        updated: a.ADVDATE ? new Date(a.ADVDATE as number).toISOString() : undefined,
      });
    }
    if (feats.length < 1000) break;
    offset += feats.length;
  }
  return out;
}

async function fetchUk(): Promise<TravelAdvisory[]> {
  const idxRes = await fetch('https://www.gov.uk/api/content/foreign-travel-advice');
  if (!idxRes.ok) throw new Error(`HTTP ${idxRes.status}`);
  const idx = (await idxRes.json()) as { links?: { children?: unknown[] } };
  const children = (idx.links?.children ?? []) as { details?: { country?: { name?: string; slug?: string } } }[];
  const out: TravelAdvisory[] = [];
  const chunkSize = 8;
  for (let i = 0; i < children.length; i += chunkSize) {
    const chunk = children.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (c) => {
        const slug = c.details?.country?.slug;
        if (!slug) return null;
        try {
          const res = await fetch(`https://www.gov.uk/api/content/foreign-travel-advice/${slug}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const d = (await res.json()) as {
            details?: { country?: { name?: string }; alert_status?: string[]; change_description?: string };
            web_url?: string;
            public_updated_at?: string;
          };
          const details = d.details ?? {};
          return {
            source: 'UK' as const,
            country: details.country?.name ?? c.details?.country?.name ?? slug,
            level: Array.isArray(details.alert_status) ? details.alert_status : [],
            levelText: Array.isArray(details.alert_status) ? details.alert_status.join(', ') : '',
            url: d.web_url ?? `https://www.gov.uk/foreign-travel-advice/${slug}`,
            updated: d.public_updated_at ?? undefined,
            summary: details.change_description ?? undefined,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}

/** Travel advisories (US State Dept, UK FCDO) from orbis-data snapshot, live fallback to both. */
export async function loadTravelAdvisories(): Promise<TravelAdvisories> {
  return snapshotJson<TravelAdvisories>(
    'intel/travel-advisories.json',
    async () => {
      const [us, uk] = await Promise.allSettled([fetchUs(), fetchUk()]);
      return {
        generated: new Date().toISOString(),
        us: us.status === 'fulfilled' ? us.value : [],
        uk: uk.status === 'fulfilled' ? uk.value : [],
      };
    },
  );
}