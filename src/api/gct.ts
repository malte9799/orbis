import { snapshotJson } from './data';

export interface GctConflict {
  id: number;
  title: string;
  region: string;
  types: string[];
  impact: string;
  status: string;
  countries: string[];
  description: string;
  actors: string[];
  image: string | null;
  url: string;
  updated: string;
}

export interface GctData {
  generated: string;
  conflicts: GctConflict[];
}

const ALGOLIA_APP = '88CM4UMCZO';
const ALGOLIA_KEY = '378e615a71f7696cbe292b15d07e3e2d';
const ALGOLIA_INDEX = 'gct_posts_conflict';

interface AlgoliaHit {
  post_id?: number;
  post_title?: string;
  post_modified?: number;
  post_date?: number;
  permalink?: string;
  description?: string | null;
  image?: { url?: string } | null;
  region?: { name?: string } | null;
  conflict_types?: { name?: string }[];
  impact_on_us_interests?: { name?: string } | null;
  conflict_status?: { name?: string } | null;
  countries_affected?: { name?: string }[];
  key_actors?: { actor?: string }[];
  taxonomies?: { region?: string[] };
}

async function fetchGctLive(): Promise<GctData> {
  const res = await fetch(`https://${ALGOLIA_APP}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Algolia-Application-Id': ALGOLIA_APP,
      'X-Algolia-API-Key': ALGOLIA_KEY,
    },
    body: JSON.stringify({ query: '', hitsPerPage: 100 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: AlgoliaHit[] };
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const conflicts: GctConflict[] = hits
    .filter((h) => h.conflict_status && h.impact_on_us_interests)
    .map((h) => ({
      id: h.post_id ?? 0,
      title: h.post_title ?? '',
      region: h.region?.name ?? (h.taxonomies?.region?.[0] ?? ''),
      types: (h.conflict_types ?? []).map((t) => t.name ?? '').filter(Boolean),
      impact: h.impact_on_us_interests?.name ?? '',
      status: h.conflict_status?.name ?? '',
      countries: (h.countries_affected ?? []).map((c) => c.name ?? '').filter(Boolean),
      description: h.description ?? '',
      actors: (h.key_actors ?? []).map((a) => a.actor ?? '').filter(Boolean),
      image: h.image?.url ?? null,
      url: h.permalink ?? '',
      updated: h.post_modified
        ? new Date(h.post_modified * 1000).toISOString()
        : h.post_date
          ? new Date(h.post_date * 1000).toISOString()
          : new Date().toISOString(),
    }));
  return { generated: new Date().toISOString(), conflicts };
}

/** CFR Global Conflict Tracker (snapshot from orbis-data, live fallback to Algolia index). */
export async function loadGct(): Promise<GctData> {
  return snapshotJson<GctData>('intel/gct.json', fetchGctLive);
}
