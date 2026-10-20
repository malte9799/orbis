import { fetchJson } from '../util';

export interface Alert {
  source: string;
  event: string;
  headline: string;
  description: string;
  instruction?: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme' | 'unknown';
  onset?: string;
  expires?: string;
}

function normSeverity(s: string | undefined): Alert['severity'] {
  const v = (s ?? '').toLowerCase();
  return v === 'minor' || v === 'moderate' || v === 'severe' || v === 'extreme' ? v : 'unknown';
}

/** DWD warnings via Bright Sky (Germany only). */
async function dwdAlerts(lat: number, lon: number): Promise<Alert[]> {
  const data = await fetchJson<{
    alerts?: {
      event_de?: string;
      headline_de?: string;
      description_de?: string;
      instruction_de?: string;
      severity?: string;
      onset?: string;
      expires?: string;
    }[];
  }>(`https://api.brightsky.dev/alerts?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, undefined, 10000);
  return (data.alerts ?? []).map((a) => ({
    source: 'Deutscher Wetterdienst (via Bright Sky)',
    event: a.event_de ?? 'Warnung',
    headline: a.headline_de ?? a.event_de ?? '',
    description: a.description_de ?? '',
    instruction: a.instruction_de,
    severity: normSeverity(a.severity),
    onset: a.onset,
    expires: a.expires,
  }));
}

/** US National Weather Service alerts for a point. */
async function nwsAlerts(lat: number, lon: number): Promise<Alert[]> {
  const data = await fetchJson<{
    features?: {
      properties: {
        event: string;
        headline?: string;
        description?: string;
        instruction?: string;
        severity?: string;
        onset?: string;
        ends?: string;
        expires?: string;
      };
    }[];
  }>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: { Accept: 'application/geo+json' },
  }, 10000);
  return (data.features ?? []).map(({ properties: p }) => ({
    source: 'National Weather Service',
    event: p.event,
    headline: p.headline ?? p.event,
    description: p.description ?? '',
    instruction: p.instruction,
    severity: normSeverity(p.severity),
    onset: p.onset,
    expires: p.ends ?? p.expires,
  }));
}

export async function getAlerts(lat: number, lon: number, countryCode?: string): Promise<Alert[]> {
  const cc = countryCode?.toUpperCase();
  try {
    if (cc === 'DE') return await dwdAlerts(lat, lon);
    if (cc === 'US') return await nwsAlerts(lat, lon);
  } catch (e) {
    console.warn('Warnungen nicht verfügbar', e);
  }
  return [];
}
