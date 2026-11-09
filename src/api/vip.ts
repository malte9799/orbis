import { snapshotJson } from './data';

export interface VipCompany {
  id: string;
  name: string;
  ticker?: string | null;
  lon: number;
  lat: number;
  industry?: string;
  employees?: number;
  founded?: string | null;
  website?: string;
  description?: string;
  quote?: { price: number; ccy: string; date: string; chg_pct: number } | null;
  hq_city?: string;
  hq_country?: string;
}

export const VIP_ATTRIBUTION =
  'Personen, Firmen, Yachten: Wikidata (CC0 1.0); Fotos: Wikimedia Commons (Lizenz und Urheber je Foto); Flugzeug-Hex-Liste und Vermögenslabels: kuratiert, Herkunft/Lizenz ungeklärt';

/** Photo credit line ("Urheber, Lizenz") or null when the person has no photo/credit. */
export function vipPhotoCredit(p: Pick<VipPerson, 'photo' | 'photo_license' | 'photo_credit'>): string | null {
  if (!p.photo || !p.photo_credit) return null;
  return p.photo_license ? `${p.photo_credit}, ${p.photo_license} (Wikimedia Commons)` : `${p.photo_credit} (Wikimedia Commons)`;
}

export interface VipAircraft { tail: string; hex: string; type: string }
export interface VipYacht { name: string; mmsi?: number; length_m?: number }

export interface VipPerson {
  id: string;
  name: string;
  role?: string;
  photo?: string | null;
  /** Commons licence short name of the photo (e.g. "CC BY-SA 4.0"); only free licences are published. */
  photo_license?: string;
  /** Photo author per Commons (plain text); show next to the photo. */
  photo_credit?: string;
  description?: string;
  net_worth_label?: string;
  citizenship?: string;
  dob?: string;
  birthplace?: string;
  education?: string | null;
  wikipedia_url?: string;
  category?: string;
  country?: string | null;
  companies: VipCompany[];
  aircraft: VipAircraft[];
  yacht: VipYacht[];
  home_lon: number;
  home_lat: number;
  description_es?: string;
  description_en?: string;
}

export interface VipData {
  generated: string;
  people: VipPerson[];
  by_hex?: Record<string, string>;
  by_mmsi?: Record<string, string>;
}

/** VIP person data from orbis-data (if available), else null. */
export async function loadVipData(): Promise<VipData | null> {
  try {
    return await snapshotJson<VipData>('vip/vip.json');
  } catch {
    return null;
  }
}