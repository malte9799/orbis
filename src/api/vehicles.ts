import type { Feature, Point } from 'geojson';
import { store } from '../store';
import { fetchJson } from '../util';
import { modeStyle } from './transit';

// Live GPS positions of public transport vehicles from open feeds around the world.
// Keyless: Entur (Norway), MBTA (Boston), SEPTA (Philadelphia), TTC (Toronto), Malaysia.
// Free key (settings): Transport Victoria, CTA Chicago, Trafiklab Sweden.
// Each feed is only requested while its region is in view.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Vehicle {
  lon: number;
  lat: number;
  name: string;
  mode: string;
  bearing?: number;
  speedKmh?: number | null;
  from?: string;
  to?: string;
  delayMin?: number | null;
}

// ---------------------------------------------------------------------------
// Minimal protobuf reader for GTFS-Realtime VehiclePositions

class Pb {
  pos = 0;
  constructor(
    readonly buf: Uint8Array,
    readonly end = buf.length,
  ) {}
  varint(): number {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = this.buf[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80 && this.pos < this.end);
    return result;
  }
  float(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getFloat32(0, true);
    this.pos += 4;
    return v;
  }
  bytes(): Pb {
    const len = this.varint();
    const sub = new Pb(this.buf, this.pos + len);
    sub.pos = this.pos;
    this.pos += len;
    return sub;
  }
  string(): string {
    const sub = this.bytes();
    return new TextDecoder().decode(this.buf.subarray(sub.pos, sub.end));
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) {
      const len = this.varint(); // read first – `pos += varint()` would use the old pos
      this.pos += len;
    }
    else if (wire === 5) this.pos += 4;
    else throw new Error(`protobuf wire type ${wire}`);
  }
  /** iterate fields: fn(fieldNumber, wireType) must consume the value or return false to skip */
  each(fn: (field: number, wire: number) => boolean | void) {
    while (this.pos < this.end) {
      const tag = this.varint();
      const field = Math.floor(tag / 8);
      const wire = tag & 7;
      const start = this.pos;
      if (fn(field, wire) === false || this.pos === start) {
        this.pos = start;
        this.skip(wire);
      }
    }
  }
}

interface RtVehicle {
  lat?: number;
  lon?: number;
  bearing?: number;
  speed?: number;
  routeId?: string;
  label?: string;
  id?: string;
}

/** GTFS-RT FeedMessage → vehicle positions */
export function decodeVehiclePositions(data: ArrayBuffer): RtVehicle[] {
  const out: RtVehicle[] = [];
  const msg = new Pb(new Uint8Array(data));
  msg.each((f, w) => {
    if (f !== 2 || w !== 2) return false; // entity
    const ent = msg.bytes();
    ent.each((ef, ew) => {
      if (ef !== 4 || ew !== 2) return false; // vehicle
      const vp = ent.bytes();
      const v: RtVehicle = {};
      vp.each((vf, vw) => {
        if (vw !== 2) return false;
        const sub = vp.bytes();
        if (vf === 2) {
          // Position
          sub.each((pf, pw) => {
            if (pw !== 5) return false;
            const x = sub.float();
            if (pf === 1) v.lat = x;
            else if (pf === 2) v.lon = x;
            else if (pf === 3) v.bearing = x;
            else if (pf === 5) v.speed = x;
          });
        } else if (vf === 1) {
          // TripDescriptor: route_id = 5
          sub.each((tf, tw) => {
            if (tf === 5 && tw === 2) v.routeId = sub.string();
            else return false;
          });
        } else if (vf === 8) {
          // VehicleDescriptor: id = 1, label = 2
          sub.each((df, dw) => {
            if (dw !== 2) return false;
            if (df === 1) v.id = sub.string();
            else if (df === 2) v.label = sub.string();
            else return false;
          });
        }
      });
      if (v.lat != null && v.lon != null && (v.lat !== 0 || v.lon !== 0)) out.push(v);
    });
  });
  return out;
}

async function fetchBinary(url: string, headers?: Record<string, string>): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

async function gtfsRt(url: string, mode: string, opts: { headers?: Record<string, string>; namePrefix?: string } = {}): Promise<Vehicle[]> {
  const list = decodeVehiclePositions(await fetchBinary(url, opts.headers));
  return list.map((v) => ({
    lon: v.lon!,
    lat: v.lat!,
    name: [opts.namePrefix, v.routeId ?? v.label ?? v.id].filter(Boolean).join(' '),
    mode,
    bearing: v.bearing,
    speedKmh: v.speed != null ? Math.round(v.speed * 3.6) : null,
  }));
}

// ---------------------------------------------------------------------------
// Feeds

export interface VehicleFeed {
  id: string;
  label: string;
  bbox: [number, number, number, number]; // west, south, east, north
  /** settings key needed (free registration) */
  key?: 'victoria' | 'cta' | 'trafiklab';
  /** seconds between requests */
  every: number;
  load(b: Bounds): Promise<Vehicle[]>;
}

const ENTUR_MODES: Record<string, string> = { RAIL: 'REGIONAL_RAIL', BUS: 'BUS', TRAM: 'TRAM', METRO: 'SUBWAY', COACH: 'COACH', WATER: 'FERRY', FERRY: 'FERRY' };

export const FEEDS: VehicleFeed[] = [
  {
    id: 'entur',
    label: 'Entur (Norwegen)',
    bbox: [4, 57.8, 31.5, 71.5],
    every: 20,
    async load(b) {
      const query = `{ vehicles(boundingBox: {minLat: ${b.south.toFixed(3)}, minLon: ${b.west.toFixed(3)}, maxLat: ${b.north.toFixed(3)}, maxLon: ${b.east.toFixed(3)}}) {
        mode bearing delay originName destinationName
        line { publicCode lineName }
        location { latitude longitude }
      } }`;
      const json = await fetchJson<{ data?: { vehicles: { mode: string; bearing?: number; delay?: number; originName?: string; destinationName?: string; line?: { publicCode?: string; lineName?: string }; location: { latitude: number; longitude: number } }[] } }>(
        'https://api.entur.io/realtime/v2/vehicles/graphql',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'ET-Client-Name': 'orbis-weather-map' }, body: JSON.stringify({ query }) },
        20000,
      );
      return (json.data?.vehicles ?? []).map((v) => ({
        lon: v.location.longitude,
        lat: v.location.latitude,
        name: v.line?.publicCode || v.line?.lineName || '',
        mode: ENTUR_MODES[v.mode] ?? v.mode,
        bearing: v.bearing,
        from: v.originName,
        to: v.destinationName,
        delayMin: v.delay != null ? Math.round(v.delay / 60) : null,
      }));
    },
  },
  {
    id: 'mbta',
    label: 'MBTA (Boston)',
    bbox: [-71.9, 41.6, -70.5, 43.0],
    every: 30,
    async load() {
      const json = await fetchJson<{
        data: { attributes: { latitude: number; longitude: number; bearing?: number; label?: string; speed?: number }; relationships?: { route?: { data?: { id: string } } } }[];
        included?: { id: string; attributes: { short_name?: string; long_name?: string; type: number } }[];
      }>('https://api-v3.mbta.com/vehicles?include=route&fields[vehicle]=latitude,longitude,bearing,label,speed&fields[route]=short_name,long_name,type', undefined, 20000);
      const routes = new Map((json.included ?? []).map((r) => [r.id, r.attributes]));
      const MODE = ['TRAM', 'SUBWAY', 'REGIONAL_RAIL', 'BUS', 'FERRY'];
      return json.data.map((v) => {
        const r = routes.get(v.relationships?.route?.data?.id ?? '');
        return {
          lon: v.attributes.longitude,
          lat: v.attributes.latitude,
          name: r?.short_name || r?.long_name || v.attributes.label || '',
          mode: MODE[r?.type ?? 3] ?? 'BUS',
          bearing: v.attributes.bearing,
          speedKmh: v.attributes.speed != null ? Math.round(v.attributes.speed * 3.6) : null,
        };
      });
    },
  },
  {
    id: 'septa',
    label: 'SEPTA Regional Rail (Philadelphia)',
    bbox: [-76.2, 39.5, -74.6, 40.5],
    every: 30,
    async load() {
      const list = await fetchJson<{ lat: string; lon: string; trainno: string; line?: string; dest?: string; SOURCE?: string; late?: number; heading?: number | string }[]>(
        'https://www3.septa.org/api/TrainView/index.php',
        undefined,
        20000,
      );
      return list.map((t) => ({
        lon: Number(t.lon),
        lat: Number(t.lat),
        name: `${t.line ?? 'Regional Rail'} ${t.trainno}`,
        mode: 'REGIONAL_RAIL',
        bearing: Number(t.heading) || 0,
        from: t.SOURCE,
        to: t.dest,
        delayMin: t.late ?? null,
      }));
    },
  },
  {
    id: 'ttc',
    label: 'TTC (Toronto)',
    bbox: [-79.7, 43.5, -79.0, 43.95],
    every: 30,
    async load() {
      const json = await fetchJson<{ vehicle?: { routeTag: string; lat: string; lon: string; heading?: string; speedKmHr?: string }[] | { routeTag: string; lat: string; lon: string } }>(
        'https://retro.umoiq.com/service/publicJSONFeed?command=vehicleLocations&a=ttc&t=0',
        undefined,
        20000,
      );
      const list = Array.isArray(json.vehicle) ? json.vehicle : json.vehicle ? [json.vehicle] : [];
      return list.map((v) => {
        const route = Number(v.routeTag);
        return {
          lon: Number(v.lon),
          lat: Number(v.lat),
          name: v.routeTag,
          // 500-series routes are streetcars
          mode: route >= 500 && route < 600 ? 'TRAM' : 'BUS',
          bearing: Number((v as { heading?: string }).heading) || 0,
          speedKmh: Number((v as { speedKmHr?: string }).speedKmHr) || null,
        };
      });
    },
  },
  {
    id: 'malaysia',
    label: 'KTM & Rapid (Malaysia)',
    bbox: [99.5, 1.2, 104.5, 6.8],
    every: 30,
    async load() {
      const base = 'https://api.data.gov.my/gtfs-realtime/vehicle-position';
      const parts = await Promise.allSettled([
        gtfsRt(`${base}/ktmb`, 'REGIONAL_RAIL', { namePrefix: 'KTM' }),
        gtfsRt(`${base}/prasarana?category=rapid-bus-kl`, 'BUS'),
        gtfsRt(`${base}/prasarana?category=rapid-bus-penang`, 'BUS'),
      ]);
      if (parts.every((p) => p.status === 'rejected')) throw (parts[0] as PromiseRejectedResult).reason;
      return parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []));
    },
  },
  {
    id: 'victoria',
    label: 'Transport Victoria (Melbourne)',
    bbox: [140.9, -39.2, 150.0, -33.9],
    key: 'victoria',
    every: 30,
    async load() {
      const key = store.getKeys().victoria!;
      const base = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1';
      const headers = { KeyId: key };
      const parts = await Promise.allSettled([
        gtfsRt(`${base}/metro/vehicle-positions`, 'SUBURBAN', { headers, namePrefix: 'Metro' }),
        gtfsRt(`${base}/vline/vehicle-positions`, 'REGIONAL_RAIL', { headers, namePrefix: 'V/Line' }),
        gtfsRt(`${base}/tram/vehicle-positions`, 'TRAM', { headers }),
        gtfsRt(`${base}/bus/vehicle-positions`, 'BUS', { headers }),
      ]);
      if (parts.every((p) => p.status === 'rejected')) throw (parts[0] as PromiseRejectedResult).reason;
      return parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []));
    },
  },
  {
    id: 'cta',
    label: 'CTA „L“ (Chicago)',
    bbox: [-88.0, 41.6, -87.5, 42.1],
    key: 'cta',
    every: 30,
    async load() {
      const key = store.getKeys().cta!;
      const json = await fetchJson<{ ctatt: { route?: { '@name': string; train?: { rn: string; destNm: string; lat: string; lon: string; heading: string; isDly: string }[] | { rn: string; destNm: string; lat: string; lon: string; heading: string; isDly: string } }[] } }>(
        `https://lapi.transitchicago.com/api/1.0/ttpositions.aspx?key=${encodeURIComponent(key)}&rt=red,blue,brn,g,org,p,pink,y&outputType=JSON`,
        undefined,
        20000,
      );
      const LINES: Record<string, string> = { red: 'Red', blue: 'Blue', brn: 'Brown', g: 'Green', org: 'Orange', p: 'Purple', pink: 'Pink', y: 'Yellow' };
      return (json.ctatt.route ?? []).flatMap((r) => {
        const trains = Array.isArray(r.train) ? r.train : r.train ? [r.train] : [];
        return trains.map((t) => ({
          lon: Number(t.lon),
          lat: Number(t.lat),
          name: `${LINES[r['@name']] ?? r['@name']} Line ${t.rn}`,
          mode: 'SUBWAY',
          bearing: Number(t.heading),
          to: t.destNm,
          delayMin: t.isDly === '1' ? 1 : 0,
        }));
      });
    },
  },
  {
    id: 'trafiklab',
    label: 'Trafiklab (Schweden)',
    bbox: [10.5, 55.2, 24.2, 69.1],
    key: 'trafiklab',
    every: 30,
    async load() {
      const key = store.getKeys().trafiklab!;
      const ops = ['sl', 'ul', 'skane', 'otraf', 'klt', 'orebro'];
      const parts = await Promise.allSettled(ops.map((op) => gtfsRt(`https://opendata.samtrafiken.se/gtfs-rt/${op}/VehiclePositions.pb?key=${encodeURIComponent(key)}`, 'BUS')));
      if (parts.every((p) => p.status === 'rejected')) throw (parts[0] as PromiseRejectedResult).reason;
      return parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []));
    },
  },
];

/** Feeds whose region intersects the view and that are usable (key present if needed). */
export function feedsInView(b: Bounds): VehicleFeed[] {
  const keys = store.getKeys();
  return FEEDS.filter((f) => (!f.key || keys[f.key]) && f.bbox[0] < b.east && f.bbox[2] > b.west && f.bbox[1] < b.north && f.bbox[3] > b.south);
}

const RAIL = new Set(['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'RAIL', 'SUBURBAN']);

export function vehicleFeatures(feed: VehicleFeed, list: Vehicle[]): Feature<Point>[] {
  return list
    .filter((v) => Number.isFinite(v.lon) && Number.isFinite(v.lat))
    .map((v) => {
      const st = modeStyle(v.mode);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
        properties: {
          src: 'gps',
          feed: feed.label,
          name: v.name || st.label,
          mode: v.mode,
          color: st.color,
          rail: RAIL.has(v.mode),
          from: v.from ?? '',
          to: v.to ?? '',
          speed: v.speedKmh ?? null,
          delay: v.delayMin ?? -999,
          realTime: true,
          bearing: v.bearing ?? 0,
        },
      };
    });
}
