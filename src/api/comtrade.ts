import { snapshotJson } from './data';

export interface ComtradeOilCountry {
  reporterCode: number;
  reporter: string | null;
  iso3: string | null;
  period: string;
  flowCode: string;
  cmdCode: string;
  primaryValueUsd: number | null;
  fobValueUsd: number | null;
  netWeightKg: number | null;
  qty: number | null;
  qtyUnitCode: number | null;
  isAggregate: boolean;
}

export interface ComtradeData {
  generated: string;
  source?: string;
  commodity?: string;
  period: string;
  countries: ComtradeOilCountry[];
}

const REPORTERS_URL = 'https://comtradeapi.un.org/files/v1/app/reference/Reporters.json';
const PREVIEW_BASE = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';

interface ReporterInfo {
  desc: string;
  iso3: string | null;
  expired: boolean;
}

async function loadReporterMap(): Promise<Map<number, ReporterInfo>> {
  const res = await fetch(REPORTERS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as { results?: any[] };
  const map = new Map<number, ReporterInfo>();
  const nowYear = new Date().getFullYear();
  for (const r of Array.isArray(raw?.results) ? raw.results : []) {
    if (r?.isGroup) continue;
    if (r?.reporterCode == null) continue;
    const code = Number(r.reporterCode);
    if (!Number.isFinite(code)) continue;
    const expired = Boolean(r?.entryExpiredDate && String(r.entryExpiredDate).slice(0, 4) < String(nowYear - 2));
    if (expired) continue;
    map.set(code, {
      desc: String(r.reporterDesc ?? r.text ?? ''),
      iso3: r.reporterCodeIsoAlpha3 ? String(r.reporterCodeIsoAlpha3) : null,
      expired: false,
    });
  }
  return map;
}

async function fetchComtradeLive(): Promise<ComtradeData> {
  const reporterMap = await loadReporterMap();
  const codes = [...reporterMap.keys()];
  const period = String(new Date().getFullYear() - 1);
  const url = `${PREVIEW_BASE}?reporterCode=${codes.join(',')}&period=${period}&cmdCode=2709&flowCode=X&partnerCode=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as { data?: any[] };
  const rows = Array.isArray(raw?.data) ? raw.data : [];
  if (rows.length < 10) throw new Error(`UN Comtrade: only ${rows.length} reporting countries`);
  const countries: ComtradeOilCountry[] = rows.map((r: any) => {
    const info = reporterMap.get(Number(r.reporterCode));
    return {
      reporterCode: Number(r.reporterCode),
      reporter: info?.desc || (r.reporterDesc ? String(r.reporterDesc) : null),
      iso3: info?.iso3 || (r.reporterISO ? String(r.reporterISO) : null),
      period: String(r.period ?? period),
      flowCode: String(r.flowCode ?? 'X'),
      cmdCode: String(r.cmdCode ?? '2709'),
      primaryValueUsd: r.primaryValue == null ? null : Number(r.primaryValue),
      fobValueUsd: r.fobvalue == null ? null : Number(r.fobvalue),
      netWeightKg: r.netWgt == null ? null : Number(r.netWgt),
      qty: r.qty == null ? null : Number(r.qty),
      qtyUnitCode: r.qtyUnitCode == null ? null : Number(r.qtyUnitCode),
      isAggregate: Boolean(r.isAggregate),
    };
  });
  countries.sort((a, b) => (b.primaryValueUsd ?? 0) - (a.primaryValueUsd ?? 0));
  return {
    generated: new Date().toISOString(),
    source: 'UN Comtrade (public preview)',
    commodity: 'Crude petroleum oils (HS 2709)',
    period,
    countries,
  };
}

/** UN Comtrade crude oil exports by origin country (snapshot from orbis-data, live fallback). */
export async function loadComtrade(): Promise<ComtradeData> {
  return snapshotJson<ComtradeData>('intel/comtrade.json', fetchComtradeLive, 120000);
}