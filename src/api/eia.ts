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

export const EIA_URL =
  'https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=DEMO_KEY&frequency=daily&data[0]=value&facets[series][]=RWTC&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=200';

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
  return { generated: new Date().toISOString(), source: 'U.S. Energy Information Administration (EIA)', prices };
}

async function fetchEiaLive(): Promise<EiaData> {
  const res = await fetch(EIA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseEiaResponse(await res.json());
}

/** EIA petroleum spot prices (snapshot from orbis-data, live fallback to the EIA API). */
export async function loadEia(): Promise<EiaData> {
  return snapshotJson<EiaData>('intel/eia.json', fetchEiaLive);
}
