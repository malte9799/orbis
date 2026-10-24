// ---------------------------------------------------------------------------
// Wikimedia Commons photo API – keyless and public. There is no open photo API
// for individual ships (MarineTraffic photos are behind login), so the panel
// shows a real photo of the ship type (tanker, cargo, ferry …).
// Query once per category and cache it in the session.

import { viaProxy } from './proxy';
import { fetchJson } from '../util';
import type { ShipCat } from './transport';

export interface ShipPhoto {
  /** scaled image URL */
  src: string;
  /** file description page on commons.wikimedia.org */
  link: string;
  photographer: string;
  license?: string;
}

/**
 * Hand-picked Commons files per category (checked for a good representative photo of the type).
 * `fetchShipPhoto` falls back to the search terms below when a file is missing.
 */
const PINNED: Partial<Record<ShipCat, string>> = {
  cargo: 'File:NYK Virgo (8154929586).jpg',
  tanker: 'File:LNG-carrier.Galea.wmt.jpg',
  passenger: 'File:Cruise Smeralda in Savona - August 2018.jpg',
  fishing: 'File:Fishing trawler (3730089942).jpg',
  tug: 'File:Frachtschiffreise32 Lotse Pilot "Stein" vor Travemünde (D).jpg',
  pleasure: 'File:Baltic Sailing.jpg',
  hsc: 'File:HSC Normandie Express 2009.jpg',
  special: 'File:Coast guard MS Bredstedt.jpg',
  other: 'File:Baltic (Ship) 2010-by-RaBoe-04.jpg',
};

/** search terms per category as fallback – deliberately "close to the camera, at sea" phrasing */
const QUERY: Record<ShipCat, string> = {
  cargo: 'container ship at sea',
  tanker: 'oil tanker ship at sea',
  passenger: 'cruise ship at sea',
  fishing: 'fishing trawler boat sea',
  tug: 'tugboat at sea',
  pleasure: 'sailing yacht sailing at sea',
  hsc: 'fast ferry boat',
  special: 'pilot boat at sea',
  other: 'merchant ship at sea',
};

interface CommonPage {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
  /** position in the search ranking */
  index?: number;
}

interface CommonsResponse {
  query?: {
    /** array because of formatversion=2 */
    pages?: CommonPage[];
  };
}

const API = 'https://commons.wikimedia.org/w/api.php';
const WIDTH = 640;
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

function parsePhoto(page: CommonPage): ShipPhoto | null {
  const info = page.imageinfo?.[0];
  const src = info?.thumburl || info?.url;
  if (!src) return null;
  const meta = info.extmetadata ?? {};
  return {
    src,
    link: info.descriptionurl || 'https://commons.wikimedia.org/',
    photographer: stripHtml(meta.Artist?.value ?? '') || 'Wikimedia Commons',
    license: stripHtml(meta.LicenseShortName?.value ?? '') || undefined,
  };
}

async function api(params: URLSearchParams): Promise<CommonPage[]> {
  params.set('action', 'query');
  params.set('format', 'json');
  params.set('origin', '*');
  params.set('prop', 'imageinfo');
  params.set('iiprop', 'url|extmetadata');
  params.set('iiurlwidth', String(WIDTH));
  params.set('formatversion', '2'); // pages as array
  const url = viaProxy(`${API}?${params.toString()}`);
  const res = await fetchJson<CommonsResponse>(url, { headers: { Accept: 'application/json' } }, 8000);
  return res?.query?.pages ?? [];
}

const photoCache = new Map<ShipCat, Promise<ShipPhoto | null>>();

export function fetchShipPhoto(cat: ShipCat): Promise<ShipPhoto | null> {
  const cached = photoCache.get(cat);
  if (cached) return cached;

  const job = (async () => {
    // 1. hand-picked file for the type
    if (PINNED[cat]) {
      try {
        const params = new URLSearchParams({ titles: PINNED[cat]! });
        const pages = await api(params);
        const photo = parsePhoto(pages[0] ?? {});
        if (photo) return photo;
      } catch {
        // fall back to the search
      }
    }

    // 2. search by the type's terms
    try {
      const params = new URLSearchParams({
        generator: 'search',
        gsrsearch: `${QUERY[cat]} filetype:bitmap`,
        gsrnamespace: '6', // File namespace
        gsrlimit: '12',
      });
      const pages = (await api(params)).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
      for (const page of pages) {
        const photo = parsePhoto(page);
        if (photo) return photo;
      }
      return null;
    } catch {
      return null;
    }
  })();

  photoCache.set(cat, job);
  return job;
}
