import { store } from '../store';
import { snapshotJson } from './data';

export interface EiaSpotPrice {
  period: string;
  series: string;
  seriesDescription: string;
  value: number | null;
  units: string;
  area: string;
  product: string;
}

export interface EiaData {
  generated: string;
  source: string;
  prices: EiaSpotPrice[];
}

export const EIA_ATTRIBUTION = 'U.S. Energy Information Administration (EIA)';

/** Live EIA API URL; needs a personal API key (key `eia` in the settings), never a shared demo key. */
export const eiaUrl = (apiKey: string) =>
  `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${encodeURIComponent(apiKey)}&frequency=daily&data[0]=value&facets[series][]=RWTC&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=200`;

export function parseEiaResponse(raw: any): EiaData {
  const rows = Array.isArray(raw?.response?.data) ? raw.response.data : [];
  const prices: EiaSpotPrice[] = rows
    .map((r: any) => ({
      period: String(r?.period ?? ''),
      series: String(r?.series ?? ''),
      seriesDescription: String(r?.['series-description'] ?? ''),
      value: r?.value == null || r?.value === '' ? null : Number(r.value),
      units: String(r?.units ?? ''),
      area: String(r?.['area-name'] ?? r?.duoarea ?? ''),
      product: String(r?.['product-name'] ?? r?.product ?? ''),
    }))
    .filter((p: EiaSpotPrice) => p.period !== '' && p.series !== '');
  if (prices.length === 0) throw new Error('EIA: no price rows');
  return { generated: new Date().toISOString(), source: EIA_ATTRIBUTION, prices };
}

async function fetchEiaLive(apiKey: string): Promise<EiaData> {
  const res = await fetch(eiaUrl(apiKey));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseEiaResponse(await res.json());
}

/** EIA petroleum spot prices (snapshot from orbis-data; live fallback only with a user-provided EIA key). */
export async function loadEia(): Promise<EiaData> {
  const key = store.getKeys().eia;
  return snapshotJson<EiaData>('intel/eia.json', key ? () => fetchEiaLive(key) : undefined);
}
