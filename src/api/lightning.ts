import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

// ---------------------------------------------------------------------------
// Lightning – live strikes from the Blitzortung.org community network (the same feed
// lightningmaps.org uses). Unofficial, undocumented WebSocket; data is for non-commercial
// use with attribution.

const HOSTS = ['ws1', 'ws7', 'ws8', 'ws3', 'ws5', 'ws6'].map((h) => `wss://${h}.blitzortung.org:443/`);

/** Strikes older than this are dropped. */
export const LIGHTNING_WINDOW_MS = 15 * 60000;
const MAX_STRIKES = 25000;
/** How long a strike keeps its detector signals (for the lines), afterwards they are dropped. */
const SIG_KEEP_MS = 90 * 1000;
/** A strike "wave" (shrinking highlight circle) lives this long. */
export const LIGHTNING_WAVE_MS = 5000;
/** Detector lines are drawn for strikes younger than this. */
export const LIGHTNING_LINES_MS = 30 * 1000;
/** Maximum detector lines drawn at once. */
const MAX_LINES = 600;
/** Maximum detector stations kept for display. */
const MAX_STATIONS = 20000;

export interface StrikeSig {
  /** station number */
  sta: number;
  lat: number;
  lon: number;
}

export interface Strike {
  lon: number;
  lat: number;
  /** strike time, ms since epoch */
  at: number;
  /** arrival time at this client, ms since epoch – together with `at` the stream delay ("Verzögerung") */
  recv: number;
  /** maximal deviation span of the location, in ns (0 if unknown) */
  mds?: number;
  /** detectors that captured the strike (dropped once the strike grows old) */
  sig?: StrikeSig[];
}

/** The feed is LZW-like compressed (decoder as used by blitzortung.org's own map). */
function decode(input: string): string {
  const chars = input.split('');
  if (!chars.length) return '';
  const dict = new Map<number, string>();
  let cur = chars[0];
  let prev = cur;
  const out = [cur];
  let code = 256;
  for (let i = 1; i < chars.length; i++) {
    const c = chars[i].charCodeAt(0);
    const entry = c < 256 ? chars[i] : (dict.get(c) ?? prev + cur);
    out.push(entry);
    cur = entry.charAt(0);
    dict.set(code++, prev + cur);
    prev = entry;
  }
  return out.join('');
}

interface RawSig {
  sta?: number;
  time?: number;
  lat?: number;
  lon?: number;
}

interface RawMsg {
  time?: number;
  lat?: number;
  lon?: number;
  mds?: number;
  sig?: RawSig[];
}

/** Distance in km between two lon/lat points (haversine, good enough for colour classes). */
function distKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Colour class for a detector line: 0 close (green), 1 medium (blue), 2 far (red). */
const distClass = (km: number) => (km < 100 ? 0 : km < 400 ? 1 : 2);

/** A small rolling sample list with an entry age of one minute. */
interface Sample {
  t: number;
  v: number;
}

export class LightningStream {
  private ws: WebSocket | null = null;
  private strikes: Strike[] = [];
  private closed = true;
  private retry = 0;
  private host = 0;
  /** total strikes received since the stream started */
  received = 0;
  connected = false;
  error = '';
  /** called once per newly located strike (already deduplicated) */
  onStrike: ((s: Strike) => void) | null = null;

  /** learned detector positions from the feed: station number → [lon, lat] */
  private stations = new Map<number, [number, number]>();

  /** arrival delay of recent strikes, smallest sample of the last minute = displayed "Verzögerung" */
  private delays: Sample[] = [];
  /** stale sample pruning */
  private prunedAt = 0;
  /** strike ids seen, to drop the duplicate messages the feed sends for neighbouring regions */
  private seen = new Set<string>();

  constructor(private onStatus: () => void) {}

  start() {
    this.closed = false;
    if (!this.ws) this.connect();
  }

  stop() {
    this.closed = true;
    this.connected = false;
    this.ws?.close();
    this.ws = null;
    this.strikes = [];
    this.received = 0;
    this.delays = [];
  }

  private connect() {
    let ws: WebSocket;
    try {
      ws = new WebSocket(HOSTS[this.host % HOSTS.length]);
    } catch {
      this.error = 'Blitzortung nicht erreichbar';
      this.onStatus();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.connected = true;
      this.error = '';
      ws.send(JSON.stringify({ a: 111 })); // all regions
      this.onStatus();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') this.handle(ev.data);
    };
    ws.onerror = () => {
      this.error = 'Blitzortung nicht erreichbar';
    };
    ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this.onStatus();
      if (this.closed) return;
      this.host++; // next server
      const delay = Math.min(60000, 1500 * 2 ** this.retry++);
      setTimeout(() => !this.closed && !this.ws && this.connect(), delay);
    };
  }

  private handle(raw: string) {
    let msg: RawMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      try {
        msg = JSON.parse(decode(raw));
      } catch {
        return;
      }
    }
    if (typeof msg.lat !== 'number' || typeof msg.lon !== 'number') return;
    const now = Date.now();
    // duplicates: the same strike is pushed once per participating container – the first one has all data
    if (msg.time !== undefined) {
      const id = `${msg.time}`;
      if (this.seen.has(id)) return;
      this.seen.add(id);
      if (this.seen.size > 60000) this.seen.clear();
    }
    // `time` is nanoseconds; fall back to arrival time if it looks wrong
    let at = typeof msg.time === 'number' ? msg.time / 1e6 : now;
    if (!Number.isFinite(at) || Math.abs(at - now) > 3600000) at = now;
    const strike: Strike = { lon: msg.lon, lat: msg.lat, at, recv: now };
    if (typeof msg.mds === 'number' && msg.mds > 0 && msg.mds < 1e12) strike.mds = msg.mds;
    if (Array.isArray(msg.sig)) {
      const sig: StrikeSig[] = [];
      for (const r of msg.sig.slice(0, 14)) {
        if (typeof r?.lat !== 'number' || typeof r?.lon !== 'number' || r.lat === 0 || r.lon === 0) continue;
        const sta = typeof r.sta === 'number' ? r.sta : 0;
        sig.push({ sta, lat: r.lat, lon: r.lon });
        if (sta && !this.stations.has(sta) && this.stations.size < MAX_STATIONS) {
          this.stations.set(sta, [r.lon, r.lat]);
          this.stationVersion++;
        }
      }
      if (sig.length) strike.sig = sig;
    }
    if (at !== now) this.record(this.delays, Math.max(0, (now - at) / 1000), now);
    this.strikes.push(strike);
    this.received++;
    if (this.strikes.length > MAX_STRIKES) {
      this.strikes.splice(0, this.strikes.length - MAX_STRIKES);
    }
    // the detector signals of old strikes are no longer needed for the lines
    if (now - this.sigPrunedAt > 2000) {
      this.sigPrunedAt = now;
      const min = now - SIG_KEEP_MS;
      let i = 0;
      while (i < this.strikes.length && this.strikes[i].at < min) {
        delete this.strikes[i].sig;
        i++;
      }
      if (i > 1024) this.strikes.splice(0, i);
    }
    this.onStrike?.(strike);
  }

  private sigPrunedAt = 0;

  private record(list: Sample[], v: number, now: number) {
    list.push({ t: now, v });
    if (now - this.prunedAt > 5000) {
      this.prunedAt = now;
      const min = now - 60000;
      for (const l of [this.delays]) while (l.length && l[0].t < min) l.shift();
    }
  }

  /** The stream delay in seconds ("Verzögerung"): smallest plausible arrival-lag of the last minute. */
  get delay() {
    let min = Infinity;
    for (const x of this.delays) min = Math.min(min, x.v);
    return Number.isFinite(min) ? min : undefined;
  }

  /** Drops expired strikes and returns the rest as map features with an age class (0 = newest). */
  features(now = Date.now()): FeatureCollection<Point> {
    const min = now - LIGHTNING_WINDOW_MS;
    let i = 0;
    while (i < this.strikes.length && this.strikes[i].at < min) i++;
    if (i) this.strikes.splice(0, i);
    const features: Feature<Point>[] = this.strikes.map((s) => {
      const ageMin = (now - s.at) / 60000;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          at: s.at,
          recv: s.recv,
          n: s.sig?.length ?? 0,
          age: ageMin < 1 ? 0 : ageMin < 5 ? 1 : ageMin < 10 ? 2 : 3,
        },
      };
    });
    return { type: 'FeatureCollection', features };
  }

  /** FeatureCollection of every detector station learned from the feed so far. */
  stationFeatures(): FeatureCollection<Point> {
    if (this.stationCache && this.stationBuilt === this.stationVersion) return this.stationCache;
    const features: Feature<Point>[] = [];
    for (const [lon, lat] of this.stations.values()) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} });
    }
    this.stationCache = { type: 'FeatureCollection', features };
    this.stationBuilt = this.stationVersion;
    return this.stationCache;
  }
  private stationCache: FeatureCollection<Point> | null = null;
  private stationBuilt = -1;
  private stationVersion = 0;
  get stationCount() {
    return this.stations.size;
  }

  /** Lines from every detector that captured a fresh strike to the strike position. */
  lineFeatures(now = Date.now(), maxAge = LIGHTNING_LINES_MS): FeatureCollection<LineString> {
    const min = now - maxAge;
    const features: Feature<LineString>[] = [];
    for (let i = this.strikes.length - 1; i >= 0 && features.length < MAX_LINES; i--) {
      const s = this.strikes[i];
      if (s.at < min) break;
      if (!s.sig) continue;
      const o = Math.round((1 - (now - s.at) / maxAge) * 100) / 100;
      for (const g of s.sig) {
        const dc = distClass(distKm(g.lon, g.lat, s.lon, s.lat));
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[g.lon, g.lat], [s.lon, s.lat]] },
          properties: { dc, o },
        });
        if (features.length >= MAX_LINES) break;
      }
    }
    return { type: 'FeatureCollection', features };
  }

  /** The shrinking highlight circles ("wave") of very fresh strikes. */
  waveFeatures(now = Date.now(), maxAge = LIGHTNING_WAVE_MS): FeatureCollection<Point> {
    const features: Feature<Point>[] = [];
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (s.at < now - maxAge) break;
      const k = Math.round(Math.max(0.04, 1 - (now - s.at) / maxAge) * 100) / 100;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { k, o: k },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  /** Young strikes exist? (decides whether the fast animation timer keeps running) */
  hasYoung(now = Date.now(), maxAge = LIGHTNING_LINES_MS) {
    return this.strikes.length > 0 && this.strikes[this.strikes.length - 1].at > now - maxAge;
  }

  get count() {
    return this.strikes.length;
  }
}
