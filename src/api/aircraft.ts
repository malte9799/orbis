import { viaProxy } from './proxy';
import { fetchJson } from '../util';

// ---------------------------------------------------------------------------
// Planespotters.net Photo API
// Public, unauthenticated API providing photos with photographer attribution.
// Query by registration first, fallback to Mode-S hex.

export interface AircraftPhoto {
  src: string;
  large: string;
  link: string;
  photographer: string;
}

interface PlanespottersResponse {
  photos?: {
    id?: string;
    thumbnail?: { src?: string };
    thumbnail_large?: { src?: string };
    link?: string;
    photographer?: string;
  }[];
}

const photoCache = new Map<string, Promise<AircraftPhoto | null>>();

export function fetchAircraftPhoto(hex: string, reg?: string): Promise<AircraftPhoto | null> {
  const cleanHex = hex.trim().toLowerCase();
  const cleanReg = reg ? reg.trim().toUpperCase() : '';
  const cacheKey = `${cleanHex}|${cleanReg}`;

  const cached = photoCache.get(cacheKey);
  if (cached) return cached;

  const job = (async () => {
    // 1. Try registration if valid (at least 2 letters/digits)
    if (cleanReg && /^[A-Z0-9-]{2,10}$/.test(cleanReg)) {
      try {
        const url = viaProxy(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(cleanReg)}`);
        const res = await fetchJson<PlanespottersResponse>(url, undefined, 6000);
        const p = res?.photos?.[0];
        if (p?.thumbnail_large?.src || p?.thumbnail?.src) {
          return {
            src: p.thumbnail?.src || p.thumbnail_large?.src || '',
            large: p.thumbnail_large?.src || p.thumbnail?.src || '',
            link: p.link || `https://www.planespotters.net/search?q=${encodeURIComponent(cleanReg)}`,
            photographer: p.photographer || 'Planespotters.net',
          };
        }
      } catch {
        // fallback to hex
      }
    }

    // 2. Try Mode-S Hex if available (6 hex characters)
    if (cleanHex && /^[0-9a-f]{6}$/.test(cleanHex)) {
      try {
        const url = viaProxy(`https://api.planespotters.net/pub/photos/hex/${encodeURIComponent(cleanHex)}`);
        const res = await fetchJson<PlanespottersResponse>(url, undefined, 6000);
        const p = res?.photos?.[0];
        if (p?.thumbnail_large?.src || p?.thumbnail?.src) {
          return {
            src: p.thumbnail?.src || p.thumbnail_large?.src || '',
            large: p.thumbnail_large?.src || p.thumbnail?.src || '',
            link: p.link || `https://www.planespotters.net/search?q=${encodeURIComponent(cleanHex)}`,
            photographer: p.photographer || 'Planespotters.net',
          };
        }
      } catch {
        // no photo found
      }
    }

    return null;
  })();

  photoCache.set(cacheKey, job);
  return job;
}

// ---------------------------------------------------------------------------
// Technical Specifications & Enthusiast Database for Common Aircraft Types

export interface AircraftSpec {
  name: string;
  mfr: string;
  wtc: 'Light (L)' | 'Medium (M)' | 'Heavy (H)' | 'Super (J)';
  engines: string;
  seats: string;
  rangeKm: number;
  spanM: number;
  lengthM: number;
  speedKmh: number;
  ceilingFt: number;
}

const SPECS: Record<string, AircraftSpec> = {
  // --- Airbus narrow-body ---
  A318: { name: 'Airbus A318', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56 / PW6000)', seats: '107–132', rangeKm: 5750, spanM: 34.1, lengthM: 31.4, speedKmh: 830, ceilingFt: 41000 },
  A319: { name: 'Airbus A319ceo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56 / V2500)', seats: '124–156', rangeKm: 6950, spanM: 34.1, lengthM: 33.8, speedKmh: 830, ceilingFt: 41000 },
  A19N: { name: 'Airbus A319neo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1A / GTF)', seats: '140–160', rangeKm: 6950, spanM: 35.8, lengthM: 33.8, speedKmh: 830, ceilingFt: 41000 },
  A320: { name: 'Airbus A320ceo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56 / V2500)', seats: '150–180', rangeKm: 6100, spanM: 34.1, lengthM: 37.6, speedKmh: 830, ceilingFt: 39000 },
  A20N: { name: 'Airbus A320neo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1A / GTF)', seats: '165–195', rangeKm: 6500, spanM: 35.8, lengthM: 37.6, speedKmh: 830, ceilingFt: 39000 },
  A321: { name: 'Airbus A321ceo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56 / V2500)', seats: '185–220', rangeKm: 5950, spanM: 34.1, lengthM: 44.5, speedKmh: 830, ceilingFt: 39000 },
  A21N: { name: 'Airbus A321neo', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1A / GTF)', seats: '180–244', rangeKm: 7400, spanM: 35.8, lengthM: 44.5, speedKmh: 830, ceilingFt: 39000 },
  BCS1: { name: 'Airbus A220-100', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (PW1500G)', seats: '100–125', rangeKm: 6390, spanM: 35.1, lengthM: 35.0, speedKmh: 830, ceilingFt: 41000 },
  BCS3: { name: 'Airbus A220-300', mfr: 'Airbus', wtc: 'Medium (M)', engines: '2× Turbofan (PW1500G)', seats: '130–160', rangeKm: 6300, spanM: 35.1, lengthM: 38.7, speedKmh: 830, ceilingFt: 41000 },

  // --- Airbus wide-body ---
  A306: { name: 'Airbus A300-600', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (CF6 / PW4000)', seats: '266', rangeKm: 7500, spanM: 44.8, lengthM: 54.1, speedKmh: 830, ceilingFt: 40000 },
  A310: { name: 'Airbus A310', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (CF6 / PW4000)', seats: '220', rangeKm: 8050, spanM: 43.9, lengthM: 46.7, speedKmh: 850, ceilingFt: 41000 },
  A332: { name: 'Airbus A330-200', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent 700 / CF6 / PW4000)', seats: '246–277 (max. 406)', rangeKm: 13450, spanM: 60.3, lengthM: 58.8, speedKmh: 870, ceilingFt: 41000 },
  A333: { name: 'Airbus A330-300', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent 700 / CF6 / PW4000)', seats: '277–300 (max. 440)', rangeKm: 11750, spanM: 60.3, lengthM: 63.7, speedKmh: 870, ceilingFt: 41000 },
  A338: { name: 'Airbus A330-800neo', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent 7000)', seats: '220–260 (max. 406)', rangeKm: 15090, spanM: 64.0, lengthM: 58.8, speedKmh: 870, ceilingFt: 41000 },
  A339: { name: 'Airbus A330-900neo', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent 7000)', seats: '260–310 (max. 460)', rangeKm: 13330, spanM: 64.0, lengthM: 63.7, speedKmh: 870, ceilingFt: 41000 },
  A342: { name: 'Airbus A340-200', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '4× Turbofan (CFM56)', seats: '240–261', rangeKm: 12400, spanM: 60.3, lengthM: 59.4, speedKmh: 880, ceilingFt: 41000 },
  A343: { name: 'Airbus A340-300', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '4× Turbofan (CFM56)', seats: '275–300', rangeKm: 13700, spanM: 60.3, lengthM: 63.7, speedKmh: 880, ceilingFt: 41000 },
  A345: { name: 'Airbus A340-500', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '4× Turbofan (Trent 500)', seats: '277–313', rangeKm: 16670, spanM: 63.5, lengthM: 67.9, speedKmh: 880, ceilingFt: 41000 },
  A346: { name: 'Airbus A340-600', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '4× Turbofan (Trent 500)', seats: '326–380', rangeKm: 14450, spanM: 63.5, lengthM: 75.4, speedKmh: 880, ceilingFt: 41000 },
  A359: { name: 'Airbus A350-900', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent XWB-84)', seats: '300–350 (max. 440)', rangeKm: 15000, spanM: 64.8, lengthM: 66.8, speedKmh: 903, ceilingFt: 43000 },
  A35K: { name: 'Airbus A350-1000', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '2× Turbofan (Trent XWB-97)', seats: '350–410 (max. 480)', rangeKm: 16100, spanM: 64.8, lengthM: 73.8, speedKmh: 903, ceilingFt: 43000 },
  A388: { name: 'Airbus A380-800', mfr: 'Airbus', wtc: 'Super (J)', engines: '4× Turbofan (Trent 900 / GP7200)', seats: '450–555 (max. 853)', rangeKm: 14800, spanM: 79.8, lengthM: 72.7, speedKmh: 903, ceilingFt: 43000 },

  // --- Boeing narrow-body ---
  B733: { name: 'Boeing 737-300', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '128–149', rangeKm: 4200, spanM: 28.9, lengthM: 33.4, speedKmh: 790, ceilingFt: 37000 },
  B734: { name: 'Boeing 737-400', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '146–168', rangeKm: 3850, spanM: 28.9, lengthM: 36.4, speedKmh: 790, ceilingFt: 37000 },
  B735: { name: 'Boeing 737-500', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '108–132', rangeKm: 4400, spanM: 28.9, lengthM: 31.0, speedKmh: 790, ceilingFt: 37000 },
  B736: { name: 'Boeing 737-600', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '110–130', rangeKm: 5650, spanM: 34.3, lengthM: 31.2, speedKmh: 830, ceilingFt: 41000 },
  B737: { name: 'Boeing 737-700', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '128–149', rangeKm: 6000, spanM: 34.3, lengthM: 33.6, speedKmh: 830, ceilingFt: 41000 },
  B738: { name: 'Boeing 737-800', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '162–189', rangeKm: 5430, spanM: 35.8, lengthM: 39.5, speedKmh: 840, ceilingFt: 41000 },
  B739: { name: 'Boeing 737-900 / 900ER', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (CFM56)', seats: '178–220', rangeKm: 5460, spanM: 35.8, lengthM: 42.1, speedKmh: 840, ceilingFt: 41000 },
  B37M: { name: 'Boeing 737 MAX 7', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1B)', seats: '138–172', rangeKm: 7130, spanM: 35.9, lengthM: 35.6, speedKmh: 840, ceilingFt: 41000 },
  B38M: { name: 'Boeing 737 MAX 8', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1B)', seats: '162–210', rangeKm: 6570, spanM: 35.9, lengthM: 39.5, speedKmh: 840, ceilingFt: 41000 },
  B39M: { name: 'Boeing 737 MAX 9', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1B)', seats: '178–220', rangeKm: 6570, spanM: 35.9, lengthM: 42.2, speedKmh: 840, ceilingFt: 41000 },
  B3JM: { name: 'Boeing 737 MAX 10', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (LEAP-1B)', seats: '188–230', rangeKm: 6110, spanM: 35.9, lengthM: 43.8, speedKmh: 840, ceilingFt: 41000 },
  B752: { name: 'Boeing 757-200', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (RB211 / PW2000)', seats: '200–239', rangeKm: 7220, spanM: 38.0, lengthM: 47.3, speedKmh: 850, ceilingFt: 42000 },
  B753: { name: 'Boeing 757-300', mfr: 'Boeing', wtc: 'Medium (M)', engines: '2× Turbofan (RB211 / PW2000)', seats: '243–295', rangeKm: 6290, spanM: 38.0, lengthM: 54.4, speedKmh: 850, ceilingFt: 42000 },

  // --- Boeing wide-body ---
  B744: { name: 'Boeing 747-400', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '4× Turbofan (CF6 / PW4000 / RB211)', seats: '416–524 (max. 660)', rangeKm: 13450, spanM: 64.4, lengthM: 70.7, speedKmh: 907, ceilingFt: 45000 },
  B748: { name: 'Boeing 747-8 Intercontinental', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '4× Turbofan (GEnx-2B)', seats: '467 (max. 605)', rangeKm: 14310, spanM: 68.4, lengthM: 76.3, speedKmh: 917, ceilingFt: 43000 },
  B762: { name: 'Boeing 767-200', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (JT9D / CF6 / PW4000)', seats: '181–224', rangeKm: 7300, spanM: 47.6, lengthM: 48.5, speedKmh: 850, ceilingFt: 43000 },
  B763: { name: 'Boeing 767-300 / 300ER', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (CF6 / PW4000 / RB211)', seats: '218–269', rangeKm: 11070, spanM: 47.6, lengthM: 54.9, speedKmh: 850, ceilingFt: 43000 },
  B764: { name: 'Boeing 767-400ER', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (CF6 / PW4000)', seats: '245–304', rangeKm: 10415, spanM: 51.9, lengthM: 61.4, speedKmh: 850, ceilingFt: 43000 },
  B772: { name: 'Boeing 777-200', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GE90 / PW4000 / Trent 800)', seats: '305–312 (max. 440)', rangeKm: 9700, spanM: 60.9, lengthM: 63.7, speedKmh: 892, ceilingFt: 43000 },
  B77L: { name: 'Boeing 777-200LR', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GE90-110B/115B)', seats: '301–317 (max. 440)', rangeKm: 15840, spanM: 64.8, lengthM: 63.7, speedKmh: 892, ceilingFt: 43000 },
  B773: { name: 'Boeing 777-300', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GE90 / PW4000 / Trent 800)', seats: '368–396 (max. 550)', rangeKm: 11120, spanM: 60.9, lengthM: 73.9, speedKmh: 892, ceilingFt: 43000 },
  B77W: { name: 'Boeing 777-300ER', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GE90-115B)', seats: '365–396 (max. 550)', rangeKm: 13650, spanM: 64.8, lengthM: 73.9, speedKmh: 892, ceilingFt: 43000 },
  B788: { name: 'Boeing 787-8 Dreamliner', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GEnx-1B / Trent 1000)', seats: '242–248 (max. 381)', rangeKm: 13620, spanM: 60.1, lengthM: 56.7, speedKmh: 903, ceilingFt: 43000 },
  B789: { name: 'Boeing 787-9 Dreamliner', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GEnx-1B / Trent 1000)', seats: '290–296 (max. 420)', rangeKm: 14140, spanM: 60.1, lengthM: 62.8, speedKmh: 903, ceilingFt: 43000 },
  B78X: { name: 'Boeing 787-10 Dreamliner', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '2× Turbofan (GEnx-1B / Trent 1000)', seats: '330–336 (max. 440)', rangeKm: 11910, spanM: 60.1, lengthM: 68.3, speedKmh: 903, ceilingFt: 43000 },

  // --- Embraer ---
  E170: { name: 'Embraer E170', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '70–78', rangeKm: 3980, spanM: 26.0, lengthM: 29.9, speedKmh: 830, ceilingFt: 41000 },
  E175: { name: 'Embraer E175', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '76–88', rangeKm: 4070, spanM: 26.0, lengthM: 31.7, speedKmh: 830, ceilingFt: 41000 },
  E190: { name: 'Embraer E190', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '96–114', rangeKm: 4540, spanM: 28.7, lengthM: 36.2, speedKmh: 830, ceilingFt: 41000 },
  E195: { name: 'Embraer E195', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '100–124', rangeKm: 4260, spanM: 28.7, lengthM: 38.7, speedKmh: 830, ceilingFt: 41000 },
  E290: { name: 'Embraer E190-E2', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (PW1900G)', seats: '96–114', rangeKm: 5300, spanM: 33.7, lengthM: 36.2, speedKmh: 830, ceilingFt: 41000 },
  E295: { name: 'Embraer E195-E2', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (PW1900G)', seats: '120–146', rangeKm: 4910, spanM: 35.1, lengthM: 41.5, speedKmh: 830, ceilingFt: 41000 },
  E145: { name: 'Embraer ERJ-145', mfr: 'Embraer', wtc: 'Medium (M)', engines: '2× Turbofan (AE3007)', seats: '50', rangeKm: 2870, spanM: 20.0, lengthM: 29.9, speedKmh: 830, ceilingFt: 37000 },

  // --- Bombardier ---
  CRJ1: { name: 'Bombardier CRJ-100', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '50', rangeKm: 3000, spanM: 21.2, lengthM: 26.8, speedKmh: 785, ceilingFt: 41000 },
  CRJ2: { name: 'Bombardier CRJ-200', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '50', rangeKm: 3150, spanM: 21.2, lengthM: 26.8, speedKmh: 785, ceilingFt: 41000 },
  CRJ7: { name: 'Bombardier CRJ-700', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '68–78', rangeKm: 3600, spanM: 23.2, lengthM: 32.3, speedKmh: 830, ceilingFt: 41000 },
  CRJ9: { name: 'Bombardier CRJ-900', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '76–90', rangeKm: 2880, spanM: 24.9, lengthM: 36.2, speedKmh: 830, ceilingFt: 41000 },
  CRJX: { name: 'Bombardier CRJ-1000', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '100', rangeKm: 3000, spanM: 26.2, lengthM: 39.1, speedKmh: 830, ceilingFt: 41000 },

  // --- Turboprops ---
  AT43: { name: 'ATR 42-300', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW120)', seats: '48', rangeKm: 1150, spanM: 24.6, lengthM: 22.7, speedKmh: 500, ceilingFt: 25000 },
  AT45: { name: 'ATR 42-500', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW127)', seats: '48', rangeKm: 1330, spanM: 24.6, lengthM: 22.7, speedKmh: 555, ceilingFt: 25000 },
  AT46: { name: 'ATR 42-600', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW127M)', seats: '48', rangeKm: 1330, spanM: 24.6, lengthM: 22.7, speedKmh: 555, ceilingFt: 25000 },
  AT72: { name: 'ATR 72-200', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW124B)', seats: '68–72', rangeKm: 1400, spanM: 27.1, lengthM: 27.2, speedKmh: 510, ceilingFt: 25000 },
  AT75: { name: 'ATR 72-500', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW127F)', seats: '68–72', rangeKm: 1330, spanM: 27.1, lengthM: 27.2, speedKmh: 510, ceilingFt: 25000 },
  AT76: { name: 'ATR 72-600', mfr: 'ATR', wtc: 'Medium (M)', engines: '2× Turboprop (PW127M)', seats: '68–72', rangeKm: 1530, spanM: 27.1, lengthM: 27.2, speedKmh: 510, ceilingFt: 25000 },
  DH8D: { name: 'De Havilland Dash 8 Q400', mfr: 'De Havilland', wtc: 'Medium (M)', engines: '2× Turboprop (PW150A)', seats: '74–90', rangeKm: 2040, spanM: 28.4, lengthM: 32.8, speedKmh: 667, ceilingFt: 27000 },
  DH8C: { name: 'De Havilland Dash 8 Q300', mfr: 'De Havilland', wtc: 'Medium (M)', engines: '2× Turboprop (PW123)', seats: '50–56', rangeKm: 1710, spanM: 27.4, lengthM: 25.7, speedKmh: 528, ceilingFt: 25000 },
  PC12: { name: 'Pilatus PC-12', mfr: 'Pilatus', wtc: 'Light (L)', engines: '1× Turboprop (PT6A)', seats: '6–9', rangeKm: 3410, spanM: 16.3, lengthM: 14.4, speedKmh: 528, ceilingFt: 30000 },
  B350: { name: 'Beechcraft Super King Air 350', mfr: 'Beechcraft', wtc: 'Light (L)', engines: '2× Turboprop (PT6A)', seats: '9–11', rangeKm: 3345, spanM: 17.6, lengthM: 14.2, speedKmh: 560, ceilingFt: 35000 },
  BE20: { name: 'Beechcraft King Air 200', mfr: 'Beechcraft', wtc: 'Light (L)', engines: '2× Turboprop (PT6A)', seats: '7–9', rangeKm: 2900, spanM: 16.6, lengthM: 13.3, speedKmh: 535, ceilingFt: 35000 },

  // --- Business Jets ---
  GLF5: { name: 'Gulfstream G550', mfr: 'Gulfstream', wtc: 'Medium (M)', engines: '2× Turbofan (BR710)', seats: '14–19', rangeKm: 12500, spanM: 28.5, lengthM: 29.4, speedKmh: 904, ceilingFt: 51000 },
  GLF6: { name: 'Gulfstream G650', mfr: 'Gulfstream', wtc: 'Medium (M)', engines: '2× Turbofan (BR725)', seats: '11–18', rangeKm: 12960, spanM: 30.4, lengthM: 30.4, speedKmh: 956, ceilingFt: 51000 },
  GLEX: { name: 'Bombardier Global 6000', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (BR710)', seats: '13–19', rangeKm: 11110, spanM: 28.7, lengthM: 30.3, speedKmh: 907, ceilingFt: 51000 },
  GL7T: { name: 'Bombardier Global 7500', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (Passport 20)', seats: '19', rangeKm: 14260, spanM: 31.7, lengthM: 33.8, speedKmh: 955, ceilingFt: 51000 },
  CL30: { name: 'Bombardier Challenger 300', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (HTF7000)', seats: '8–10', rangeKm: 5740, spanM: 19.5, lengthM: 20.9, speedKmh: 850, ceilingFt: 45000 },
  CL35: { name: 'Bombardier Challenger 350', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (HTF7350)', seats: '9–10', rangeKm: 5920, spanM: 21.0, lengthM: 20.9, speedKmh: 850, ceilingFt: 45000 },
  CL60: { name: 'Bombardier Challenger 600/605', mfr: 'Bombardier', wtc: 'Medium (M)', engines: '2× Turbofan (CF34)', seats: '10–12', rangeKm: 7400, spanM: 19.6, lengthM: 20.9, speedKmh: 850, ceilingFt: 41000 },
  FA7X: { name: 'Dassault Falcon 7X', mfr: 'Dassault', wtc: 'Medium (M)', engines: '3× Turbofan (PW307A)', seats: '12–16', rangeKm: 11020, spanM: 26.2, lengthM: 23.4, speedKmh: 900, ceilingFt: 51000 },
  FA8X: { name: 'Dassault Falcon 8X', mfr: 'Dassault', wtc: 'Medium (M)', engines: '3× Turbofan (PW307D)', seats: '12–16', rangeKm: 11945, spanM: 26.3, lengthM: 24.5, speedKmh: 900, ceilingFt: 51000 },
  C510: { name: 'Cessna Citation Mustang', mfr: 'Cessna', wtc: 'Light (L)', engines: '2× Turbofan (PW615F)', seats: '4–5', rangeKm: 2160, spanM: 13.2, lengthM: 12.4, speedKmh: 630, ceilingFt: 41000 },
  C525: { name: 'Cessna CitationJet / CJ series', mfr: 'Cessna', wtc: 'Light (L)', engines: '2× Turbofan (FJ44)', seats: '5–8', rangeKm: 3470, spanM: 16.3, lengthM: 15.6, speedKmh: 770, ceilingFt: 45000 },
  C56X: { name: 'Cessna Citation Excel / XLS', mfr: 'Cessna', wtc: 'Medium (M)', engines: '2× Turbofan (PW545)', seats: '8–9', rangeKm: 3850, spanM: 17.2, lengthM: 16.0, speedKmh: 802, ceilingFt: 45000 },
  C680: { name: 'Cessna Citation Sovereign', mfr: 'Cessna', wtc: 'Medium (M)', engines: '2× Turbofan (PW306C)', seats: '8–12', rangeKm: 5920, spanM: 22.0, lengthM: 19.4, speedKmh: 850, ceilingFt: 47000 },
  C750: { name: 'Cessna Citation X', mfr: 'Cessna', wtc: 'Medium (M)', engines: '2× Turbofan (AE3007C)', seats: '8–12', rangeKm: 6400, spanM: 19.4, lengthM: 22.0, speedKmh: 972, ceilingFt: 51000 },
  PC24: { name: 'Pilatus PC-24', mfr: 'Pilatus', wtc: 'Medium (M)', engines: '2× Turbofan (FJ44-4A)', seats: '8–10', rangeKm: 3770, spanM: 17.0, lengthM: 16.8, speedKmh: 815, ceilingFt: 45000 },
  E55P: { name: 'Embraer Phenom 300', mfr: 'Embraer', wtc: 'Light (L)', engines: '2× Turbofan (PW535E)', seats: '7–10', rangeKm: 3720, spanM: 15.9, lengthM: 15.9, speedKmh: 833, ceilingFt: 45000 },
  E50P: { name: 'Embraer Phenom 100', mfr: 'Embraer', wtc: 'Light (L)', engines: '2× Turbofan (PW617F)', seats: '4–5', rangeKm: 2180, spanM: 12.3, lengthM: 12.8, speedKmh: 722, ceilingFt: 41000 },

  // --- General Aviation ---
  C172: { name: 'Cessna 172 Skyhawk', mfr: 'Cessna', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming O-360)', seats: '4', rangeKm: 1290, spanM: 11.0, lengthM: 8.3, speedKmh: 226, ceilingFt: 14000 },
  C182: { name: 'Cessna 182 Skylane', mfr: 'Cessna', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming O-540)', seats: '4', rangeKm: 1720, spanM: 11.0, lengthM: 8.8, speedKmh: 269, ceilingFt: 18100 },
  C206: { name: 'Cessna 206 Stationair', mfr: 'Cessna', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming IO-540)', seats: '6', rangeKm: 1350, spanM: 11.0, lengthM: 8.6, speedKmh: 263, ceilingFt: 15700 },
  C208: { name: 'Cessna 208 Caravan', mfr: 'Cessna', wtc: 'Light (L)', engines: '1× Turboprop (PT6A)', seats: '9–14', rangeKm: 1980, spanM: 15.9, lengthM: 11.5, speedKmh: 344, ceilingFt: 25000 },
  PA28: { name: 'Piper PA-28 Cherokee', mfr: 'Piper', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming O-320)', seats: '4', rangeKm: 950, spanM: 10.8, lengthM: 7.3, speedKmh: 215, ceilingFt: 14300 },
  PA34: { name: 'Piper PA-34 Seneca', mfr: 'Piper', wtc: 'Light (L)', engines: '2× Kolbenmotor (Continental TSIO-360)', seats: '6', rangeKm: 1610, spanM: 11.9, lengthM: 8.7, speedKmh: 348, ceilingFt: 25000 },
  SR20: { name: 'Cirrus SR20', mfr: 'Cirrus', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming IO-390)', seats: '4–5', rangeKm: 1300, spanM: 11.7, lengthM: 7.9, speedKmh: 287, ceilingFt: 17500 },
  SR22: { name: 'Cirrus SR22', mfr: 'Cirrus', wtc: 'Light (L)', engines: '1× Kolbenmotor (Continental IO-550)', seats: '4–5', rangeKm: 1940, spanM: 11.7, lengthM: 7.9, speedKmh: 340, ceilingFt: 25000 },
  SF50: { name: 'Cirrus Vision SF50', mfr: 'Cirrus', wtc: 'Light (L)', engines: '1× Turbofan (Williams FJ33)', seats: '5–7', rangeKm: 2360, spanM: 11.8, lengthM: 9.4, speedKmh: 576, ceilingFt: 31000 },
  DA40: { name: 'Diamond DA40 Star', mfr: 'Diamond', wtc: 'Light (L)', engines: '1× Kolbenmotor (Austro Engine / Lycoming)', seats: '4', rangeKm: 1340, spanM: 11.5, lengthM: 8.1, speedKmh: 250, ceilingFt: 16400 },
  DA42: { name: 'Diamond DA42 Twin Star', mfr: 'Diamond', wtc: 'Light (L)', engines: '2× Kolbenmotor (Austro Engine AE300)', seats: '4', rangeKm: 1700, spanM: 13.4, lengthM: 8.6, speedKmh: 287, ceilingFt: 18000 },
  DA62: { name: 'Diamond DA62', mfr: 'Diamond', wtc: 'Light (L)', engines: '2× Kolbenmotor (Austro Engine AE330)', seats: '7', rangeKm: 2370, spanM: 14.5, lengthM: 9.2, speedKmh: 317, ceilingFt: 20000 },

  // --- Helicopters ---
  EC35: { name: 'Airbus Helicopters H135', mfr: 'Airbus Helicopters', wtc: 'Light (L)', engines: '2× Wellenturbine (Arrius 2B / PW206B)', seats: '6–7', rangeKm: 635, spanM: 10.2, lengthM: 12.2, speedKmh: 254, ceilingFt: 20000 },
  EC45: { name: 'Airbus Helicopters H145', mfr: 'Airbus Helicopters', wtc: 'Light (L)', engines: '2× Wellenturbine (Arriel 2E)', seats: '8–10', rangeKm: 650, spanM: 11.0, lengthM: 13.0, speedKmh: 246, ceilingFt: 20000 },
  AS50: { name: 'Airbus Helicopters H125 / Écureuil', mfr: 'Airbus Helicopters', wtc: 'Light (L)', engines: '1× Wellenturbine (Arriel 2D)', seats: '5–6', rangeKm: 660, spanM: 10.7, lengthM: 12.9, speedKmh: 245, ceilingFt: 23000 },
  B06: { name: 'Bell 206 JetRanger', mfr: 'Bell', wtc: 'Light (L)', engines: '1× Wellenturbine (Allison 250)', seats: '4–5', rangeKm: 690, spanM: 10.2, lengthM: 12.1, speedKmh: 215, ceilingFt: 13500 },
  R44: { name: 'Robinson R44', mfr: 'Robinson', wtc: 'Light (L)', engines: '1× Kolbenmotor (Lycoming O-540)', seats: '4', rangeKm: 560, spanM: 10.1, lengthM: 11.7, speedKmh: 200, ceilingFt: 14000 },
  R66: { name: 'Robinson R66', mfr: 'Robinson', wtc: 'Light (L)', engines: '1× Wellenturbine (Rolls-Royce RR300)', seats: '5', rangeKm: 650, spanM: 10.1, lengthM: 11.7, speedKmh: 222, ceilingFt: 14000 },
  AW39: { name: 'AgustaWestland AW139', mfr: 'Leonardo', wtc: 'Medium (M)', engines: '2× Wellenturbine (PT6C-67C)', seats: '15', rangeKm: 1060, spanM: 13.8, lengthM: 16.6, speedKmh: 306, ceilingFt: 20000 },

  // --- Military & Heavy Transport ---
  C130: { name: 'Lockheed C-130 Hercules', mfr: 'Lockheed Martin', wtc: 'Medium (M)', engines: '4× Turboprop (Allison T56 / AE2100)', seats: 'Fracht / bis 92 Passagiere', rangeKm: 3800, spanM: 40.4, lengthM: 29.8, speedKmh: 540, ceilingFt: 33000 },
  C17: { name: 'Boeing C-17 Globemaster III', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '4× Turbofan (F117 / PW2000)', seats: 'Fracht / bis 102 Fallschirmjäger', rangeKm: 4480, spanM: 51.7, lengthM: 53.0, speedKmh: 830, ceilingFt: 45000 },
  A400: { name: 'Airbus A400M Atlas', mfr: 'Airbus', wtc: 'Heavy (H)', engines: '4× Turboprop (Europrop TP400)', seats: 'Fracht / bis 116 Fallschirmjäger', rangeKm: 6400, spanM: 42.4, lengthM: 45.1, speedKmh: 780, ceilingFt: 40000 },
  K35R: { name: 'Boeing KC-135 Stratotanker', mfr: 'Boeing', wtc: 'Heavy (H)', engines: '4× Turbofan (CFM56)', seats: 'Tanker / Fracht', rangeKm: 2400, spanM: 39.9, lengthM: 41.5, speedKmh: 850, ceilingFt: 50000 },
};

export function lookupAircraftSpec(icaoCode?: string): AircraftSpec | null {
  if (!icaoCode) return null;
  const code = icaoCode.trim().toUpperCase();
  return SPECS[code] ?? null;
}

/** Link to AeroLOPA or SeatGuru for seat maps */
export function seatmapUrl(icao?: string, operator?: string): string {
  const op = operator ? operator.trim() : '';
  const spec = lookupAircraftSpec(icao);
  const name = spec?.name || icao || '';
  if (!op && !name) return 'https://www.aerolopa.com/';
  // Search on Google specifically for the airline and aircraft seat map on aerolopa.com
  return `https://www.google.com/search?q=${encodeURIComponent(`${op} ${name} seat map site:aerolopa.com`)}`;
}
