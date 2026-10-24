import type { Feature, FeatureCollection, Point } from 'geojson';
import { store } from '../store';
import { proxyBase } from './proxy';
import { fetchJson } from '../util';

// Live transport and spaceflight: rocket launches, airports, ships (AIS) and trains.

const point = (lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

// ---------------------------------------------------------------------------
// Rocket launches – The Space Devs Launch Library 2 (free, 15 requests/hour without key).
// Cached for an hour in localStorage; one map point per launch pad.

export interface Launch {
  name: string;
  net: string;
  status: string;
  provider: string;
  rocket: string;
  mission: string;
  video?: string;
  url: string;
}

const LAUNCH_CACHE = 'wg.launches.v1';

interface LL2Launch {
  id: string;
  slug?: string;
  name: string;
  net: string;
  status?: { abbrev?: string; name?: string };
  launch_service_provider?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  mission?: { description?: string; name?: string; orbit?: { name?: string } };
  pad?: { name?: string; latitude?: string | number; longitude?: string | number; location?: { name?: string } };
  vid_urls?: { url?: string; priority?: number }[];
}

const STATUS_DE: Record<string, string> = {
  Go: 'Startbereit',
  TBD: 'Termin offen',
  TBC: 'Termin unbestätigt',
  Hold: 'Angehalten',
  'In Flight': 'Im Flug',
  Success: 'Erfolgreich',
  Failure: 'Fehlgeschlagen',
};

export async function loadLaunches(): Promise<FeatureCollection<Point>> {
  try {
    const cached = JSON.parse(localStorage.getItem(LAUNCH_CACHE) ?? 'null') as { at: number; fc: FeatureCollection<Point> } | null;
    if (cached && Date.now() - cached.at < 60 * 60000) return cached.fc;
  } catch {
    /* ignore */
  }
  const json = await fetchJson<{ results: LL2Launch[] }>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=detailed&hide_recent_previous=true', undefined, 30000);
  const byPad = new Map<string, { lon: number; lat: number; pad: string; place: string; launches: Launch[] }>();
  for (const l of json.results) {
    const lat = Number(l.pad?.latitude);
    const lon = Number(l.pad?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const entry = byPad.get(key) ?? { lon, lat, pad: l.pad?.name ?? '', place: l.pad?.location?.name ?? '', launches: [] };
    const video = [...(l.vid_urls ?? [])].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0]?.url;
    entry.launches.push({
      name: l.name,
      net: l.net,
      status: STATUS_DE[l.status?.abbrev ?? ''] ?? l.status?.name ?? '',
      provider: l.launch_service_provider?.name ?? '',
      rocket: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? '',
      mission: [l.mission?.orbit?.name, l.mission?.description].filter(Boolean).join(' – '),
      video,
      url: `https://thespacedevs.com/launch/${l.id}`,
    });
    byPad.set(key, entry);
  }
  const fc: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [...byPad.values()].map((p) => {
      p.launches.sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
      return point(p.lon, p.lat, { pad: p.pad, place: p.place, next: p.launches[0].net, title: p.launches[0].name, launches: JSON.stringify(p.launches) });
    }),
  };
  try {
    localStorage.setItem(LAUNCH_CACHE, JSON.stringify({ at: Date.now(), fc }));
  } catch {
    /* ignore */
  }
  return fc;
}

/** "in 3 T. 4 Std." / "in 25 min" / "vor 5 min" */
export function countdown(iso: string): string {
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = d ? `${d} T. ${h} Std.` : h ? `${h} Std. ${m} min` : `${m} min`;
  return diff >= 0 ? `in ${s}` : `vor ${s}`;
}

// ---------------------------------------------------------------------------
// Airports – positions come from the OpenFreeMap vector tiles (aerodrome_label); the popup
// shows yesterday's departures and arrivals from the OpenSky Network (anonymous, free).

export interface AirportFlight {
  callsign: string;
  other: string;
  time: number;
}

export async function loadAirportFlights(icao: string): Promise<{ departures: AirportFlight[]; arrivals: AirportFlight[] }> {
  // OpenSky processes flights in nightly batches – query the previous day
  const end = Math.floor(Date.now() / 1000) - 3600 * 2;
  const begin = end - 86400;
  type F = { callsign: string | null; estDepartureAirport: string | null; estArrivalAirport: string | null; firstSeen: number; lastSeen: number };
  const base = 'https://opensky-network.org/api/flights';
  const [dep, arr] = await Promise.allSettled([
    fetchJson<F[]>(`${base}/departure?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`, undefined, 20000),
    fetchJson<F[]>(`${base}/arrival?airport=${encodeURIComponent(icao)}&begin=${begin}&end=${end}`, undefined, 20000),
  ]);
  if (dep.status === 'rejected' && arr.status === 'rejected') throw dep.reason;
  const map = (list: F[], other: 'estArrivalAirport' | 'estDepartureAirport', t: 'firstSeen' | 'lastSeen') =>
    list
      .map((f) => ({ callsign: (f.callsign ?? '').trim(), other: f[other] ?? '?', time: f[t] * 1000 }))
      .sort((a, b) => b.time - a.time);
  return {
    departures: dep.status === 'fulfilled' ? map(dep.value ?? [], 'estArrivalAirport', 'firstSeen') : [],
    arrivals: arr.status === 'fulfilled' ? map(arr.value ?? [], 'estDepartureAirport', 'lastSeen') : [],
  };
}

// ---------------------------------------------------------------------------
// Ships (AIS)
// • Fintraffic Digitraffic Marine: all vessels in the Baltic Sea around Finland, keyless.
// • aisstream.io: worldwide live AIS via WebSocket with a free API key (settings).

export type ShipCat = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'tug' | 'pleasure' | 'hsc' | 'special' | 'other';

export const SHIP_COLORS: Record<ShipCat, string> = {
  cargo: '#7bd389',
  tanker: '#ff7043',
  passenger: '#4fc3f7',
  fishing: '#ffb74d',
  tug: '#26c6da',
  pleasure: '#ce93d8',
  hsc: '#fff176',
  special: '#90a4ae',
  other: '#b0bec5',
};
export const SHIP_LABELS: Record<ShipCat, string> = {
  cargo: 'Frachtschiff',
  tanker: 'Tanker',
  passenger: 'Passagierschiff/Fähre',
  fishing: 'Fischereifahrzeug',
  tug: 'Schlepper/Lotse',
  pleasure: 'Sportboot/Segler',
  hsc: 'Schnellfähre',
  special: 'Behörde/Spezialschiff',
  other: 'Schiff',
};

export function shipCat(type: number | undefined): ShipCat {
  if (type == null) return 'other';
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 80 && type <= 89) return 'tanker';
  if (type >= 60 && type <= 69) return 'passenger';
  if (type === 30) return 'fishing';
  if (type === 31 || type === 32 || type === 52 || type === 50) return 'tug';
  if (type === 36 || type === 37) return 'pleasure';
  if (type >= 40 && type <= 49) return 'hsc';
  if (type === 35 || type === 51 || type === 53 || type === 54 || type === 55 || type === 58) return 'special';
  return 'other';
}

export interface Ship {
  mmsi: number;
  lon: number;
  lat: number;
  sog: number;
  cog: number;
  heading: number;
  at: number;
  name?: string;
  type?: number;
  destination?: string;
  callSign?: string;
  source: string;
}

export function shipFeatures(ships: Iterable<Ship>): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const s of ships) {
    const cat = shipCat(s.type);
    const moving = s.sog > 0.5;
    features.push(
      point(s.lon, s.lat, {
        mmsi: s.mmsi,
        name: s.name || `MMSI ${s.mmsi}`,
        cat,
        color: SHIP_COLORS[cat],
        moving,
        rot: s.heading >= 0 && s.heading < 360 ? s.heading : s.cog,
        sog: s.sog,
        dest: s.destination ?? '',
        call: s.callSign ?? '',
        at: s.at,
        source: s.source,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

let vesselMeta: Promise<Map<number, { name: string; shipType: number; destination: string; callSign: string }>> | null = null;

function digitrafficVessels() {
  vesselMeta ??= fetchJson<{ mmsi: number; name: string; shipType: number; destination: string; callSign: string }[]>('https://meri.digitraffic.fi/api/ais/v1/vessels', undefined, 40000)
    .then((list) => new Map(list.map((v) => [v.mmsi, v])))
    .catch((e) => {
      vesselMeta = null;
      throw e;
    });
  return vesselMeta;
}

/** All vessels reported to Fintraffic in the last hour (Baltic Sea). */
export async function loadDigitrafficShips(): Promise<Ship[]> {
  const since = Date.now() - 60 * 60000;
  const [pos, meta] = await Promise.all([
    fetchJson<{ features: { mmsi: number; geometry: { coordinates: [number, number] }; properties: { sog: number; cog: number; heading: number; timestampExternal: number } }[] }>(
      `https://meri.digitraffic.fi/api/ais/v1/locations?from=${since}`,
      undefined,
      40000,
    ),
    digitrafficVessels().catch(() => new Map()),
  ]);
  return pos.features
    .filter((f) => f.properties.timestampExternal >= since)
    .map((f) => {
      const m = meta.get(f.mmsi);
      return {
        mmsi: f.mmsi,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        sog: f.properties.sog,
        cog: f.properties.cog,
        heading: f.properties.heading === 511 ? -1 : f.properties.heading,
        at: f.properties.timestampExternal,
        name: m?.name?.trim(),
        type: m?.shipType,
        destination: m?.destination?.trim(),
        callSign: m?.callSign,
        source: 'Fintraffic Digitraffic (CC BY 4.0)',
      };
    });
}

export const hasAisKey = () => !!store.getKeys().aisstream;

/** Worldwide AIS works with the user's own key or through the shared proxy (/ais relay). */
export const hasAisLive = () => hasAisKey() || !!proxyBase();

function aisSocketUrl(): string {
  if (hasAisKey()) return 'wss://stream.aisstream.io/v0/stream';
  const u = new URL(proxyBase());
  u.protocol = 'wss:';
  u.pathname = `${u.pathname.replace(/\/$/, '')}/ais`;
  u.search = '';
  return u.toString();
}

/** Live AIS stream for the visible map area (aisstream.io, free key). */
export class AisStream {
  private ws: WebSocket | null = null;
  readonly ships = new Map<number, Ship>();
  private box: [[number, number], [number, number]] | null = null;
  private retry = 0;
  private closed = true;
  error = '';

  constructor(private onUpdate: () => void) {}

  start(box: { west: number; south: number; east: number; north: number }) {
    this.box = [
      [box.south, box.west],
      [box.north, box.east],
    ];
    this.closed = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.subscribe();
    else if (!this.ws) this.connect();
  }

  stop() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (!hasAisLive()) return;
    const ws = new WebSocket(aisSocketUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.error = '';
      this.subscribe();
    };
    ws.onmessage = async (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text();
      this.handle(text);
    };
    ws.onerror = () => {
      this.error = hasAisKey() ? 'aisstream.io nicht erreichbar – Schlüssel prüfen' : 'AIS-Relay des Daten-Proxys nicht erreichbar (AISSTREAM_KEY im Worker gesetzt?)';
      this.onUpdate();
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.closed) return;
      // reconnect with back-off
      const delay = Math.min(60000, 2000 * 2 ** this.retry++);
      setTimeout(() => !this.closed && !this.ws && this.connect(), delay);
    };
  }

  private subscribe() {
    if (!this.ws || !this.box) return;
    // via the proxy the worker adds the key and the message filter
    const key = store.getKeys().aisstream;
    this.ws.send(JSON.stringify(key ? { APIKey: key, BoundingBoxes: [this.box], FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData'] } : { BoundingBoxes: [this.box] }));
  }

  private handle(text: string) {
    let msg: { MessageType?: string; error?: string; MetaData?: { MMSI: number; ShipName?: string; latitude: number; longitude: number; time_utc?: string }; Message?: Record<string, Record<string, unknown>> };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.error) {
      this.error = `aisstream.io: ${msg.error}`;
      this.onUpdate();
      return;
    }
    const meta = msg.MetaData;
    if (!meta || !msg.MessageType) return;
    const body = msg.Message?.[msg.MessageType] ?? {};
    const prev = this.ships.get(meta.MMSI);
    if (msg.MessageType === 'ShipStaticData') {
      if (prev) {
        prev.type = Number(body.Type) || prev.type;
        prev.destination = String(body.Destination ?? '').trim() || prev.destination;
        prev.callSign = String(body.CallSign ?? '').trim() || prev.callSign;
      }
      return;
    }
    const ship: Ship = {
      ...(prev ?? { source: 'aisstream.io' }),
      mmsi: meta.MMSI,
      lon: meta.longitude,
      lat: meta.latitude,
      sog: Number(body.Sog ?? 0),
      cog: Number(body.Cog ?? 0),
      heading: Number(body.TrueHeading ?? 511) === 511 ? -1 : Number(body.TrueHeading),
      at: Date.now(),
      name: (meta.ShipName ?? '').trim() || prev?.name,
    } as Ship;
    this.ships.set(meta.MMSI, ship);
    if (this.ships.size > 8000) {
      const cutoff = Date.now() - 20 * 60000;
      for (const [k, s] of this.ships) if (s.at < cutoff) this.ships.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Trains – Fintraffic Digitraffic Rail: GPS position of every train in Finland (keyless).

export async function loadTrains(): Promise<FeatureCollection<Point>> {
  const list = await fetchJson<{ trainNumber: number; departureDate: string; timestamp: string; location: { coordinates: [number, number] }; speed: number }[]>(
    'https://rata.digitraffic.fi/api/v1/train-locations/latest/',
    undefined,
    20000,
  );
  return {
    type: 'FeatureCollection',
    features: list.map((t) =>
      point(t.location.coordinates[0], t.location.coordinates[1], { src: 'fi', rail: true, num: t.trainNumber, name: `Zug ${t.trainNumber}`, color: '#ffca28', date: t.departureDate, speed: t.speed, at: t.timestamp }),
    ),
  };
}

let stationNames: Promise<Map<string, string>> | null = null;

/** Train type, route and delay for the popup. */
export async function loadTrainDetails(num: number, date: string) {
  stationNames ??= fetchJson<{ stationShortCode: string; stationName: string }[]>('https://rata.digitraffic.fi/api/v1/metadata/stations')
    .then((l) => new Map(l.map((s) => [s.stationShortCode, s.stationName.replace(/ asema$/, '')])))
    .catch(() => new Map());
  const [trains, names] = await Promise.all([
    fetchJson<{ trainType: string; trainCategory: string; commuterLineID?: string; operatorShortCode: string; timeTableRows: { stationShortCode: string; type: string; actualTime?: string; differenceInMinutes?: number }[] }[]>(
      `https://rata.digitraffic.fi/api/v1/trains/${date}/${num}`,
    ),
    stationNames,
  ]);
  const t = trains[0];
  if (!t) return null;
  const rows = t.timeTableRows;
  const name = (c?: string) => (c ? (names.get(c) ?? c) : '');
  const last = [...rows].reverse().find((r) => r.actualTime);
  return {
    title: `${t.commuterLineID ? `Linie ${t.commuterLineID}` : t.trainType} ${num}`,
    category: { 'Long-distance': 'Fernverkehr', Commuter: 'Nahverkehr', Cargo: 'Güterzug', Locomotive: 'Lokfahrt', Shunting: 'Rangierfahrt' }[t.trainCategory] ?? t.trainCategory,
    from: name(rows[0]?.stationShortCode),
    to: name(rows[rows.length - 1]?.stationShortCode),
    delay: last?.differenceInMinutes ?? null,
    lastStation: name(last?.stationShortCode),
  };
}
