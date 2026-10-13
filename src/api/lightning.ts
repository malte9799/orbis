import type { Feature, FeatureCollection, Point } from 'geojson';

// ---------------------------------------------------------------------------
// Lightning – live strikes from the Blitzortung.org community network (the same feed
// lightningmaps.org uses). Unofficial, undocumented WebSocket; data is for non-commercial
// use with attribution.

const HOSTS = ['ws1', 'ws7', 'ws8', 'ws3', 'ws5', 'ws6'].map((h) => `wss://${h}.blitzortung.org:443/`);

/** Strikes older than this are dropped. */
export const LIGHTNING_WINDOW_MS = 15 * 60000;
const MAX_STRIKES = 25000;

export interface Strike {
  lon: number;
  lat: number;
  /** strike time, ms since epoch */
  at: number;
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
    let msg: { time?: number; lat?: number; lon?: number };
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
    // `time` is nanoseconds; fall back to arrival time if it looks wrong
    let at = typeof msg.time === 'number' ? msg.time / 1e6 : now;
    if (!Number.isFinite(at) || Math.abs(at - now) > 3600000) at = now;
    this.strikes.push({ lon: msg.lon, lat: msg.lat, at });
    this.received++;
    if (this.strikes.length > MAX_STRIKES) this.strikes.splice(0, this.strikes.length - MAX_STRIKES);
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
        properties: { at: s.at, age: ageMin < 1 ? 0 : ageMin < 5 ? 1 : ageMin < 10 ? 2 : 3 },
      };
    });
    return { type: 'FeatureCollection', features };
  }

  get count() {
    return this.strikes.length;
  }
}
