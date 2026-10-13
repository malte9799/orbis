// Shared data proxy for Orbis (Cloudflare Worker, free plan: 100,000 requests/day).
//
// - Live flight data: adsb.lol, adsb.fi, airplanes.live and OpenSky block browser requests
//   from other sites (no CORS) – the proxy adds the CORS headers.
// - Overpass (OpenStreetMap): answers are cached, so many visitors looking at the same area
//   cost the public servers only one request.
//
// Setup: see "Daten-Proxy" in README.md. Optional variable ALLOWED_ORIGINS
// (Settings → Variables), comma separated, e.g.
//   https://malte9799.github.io,http://localhost:5173
// restricts the proxy to your own site so others cannot use up your daily quota.
//
// Usage: GET https://<worker>/?url=<encoded target URL>

// host → seconds an answer stays cached
const HOSTS = {
  'api.adsb.lol': 8,
  'opendata.adsb.fi': 8,
  'api.airplanes.live': 8,
  'opensky-network.org': 30,
  'overpass-api.de': 900,
  'overpass.private.coffee': 900,
  '511on.ca': 600,
  '511.alberta.ca': 600,
  'developer.nps.gov': 600,
  'maps2.dcgis.dc.gov': 600,
  'verkehr.autobahn.de': 600,
  'www3.septa.org': 30,
};
// the worldwide OpenSky overview is large and changes slowly
const ttlFor = (url) => (url.hostname === 'opensky-network.org' && !url.searchParams.has('lamin') ? 90 : HOSTS[url.hostname]);

// Small in-memory cache per worker instance. Complements Cloudflare's edge cache, which is
// not available on every setup (e.g. *.workers.dev) – absorbs bursts of identical requests.
const memory = new Map();
const MEMORY_MAX = 60;
const pending = new Map();

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 });
    const headers = cors(allowed.length ? origin : '*');

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url') ?? '');
    } catch {
      return new Response('Missing or invalid ?url=', { status: 400, headers });
    }
    if (target.protocol !== 'https:' || !(target.hostname in HOSTS)) {
      return new Response('Host not allowed', { status: 403, headers });
    }

    const key = target.toString();
    const ttl = ttlFor(target);
    const hit = memory.get(key);
    if (hit && Date.now() - hit.at < ttl * 1000) return respond(hit, headers, ttl, 'HIT');

    // identical requests arriving at the same time share one upstream request
    let job = pending.get(key);
    if (!job) {
      job = load(target, ttl).finally(() => pending.delete(key));
      pending.set(key, job);
    }
    let entry;
    try {
      entry = await job;
    } catch (e) {
      return new Response(`Upstream not reachable: ${e}`, { status: 502, headers });
    }
    if (entry.status === 200) {
      memory.delete(key);
      memory.set(key, entry);
      while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value);
    }
    return respond(entry, headers, ttl, 'MISS');
  },
};

async function load(target, ttl) {
  const res = await fetch(target.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'Orbis-Proxy/2.0 (+https://github.com/malte9799/orbis)' },
    cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '300-599': 0 } },
  });
  return {
    at: Date.now(),
    status: res.status,
    type: res.headers.get('Content-Type') ?? 'application/json',
    retryAfter: res.headers.get('Retry-After'),
    body: await res.arrayBuffer(),
  };
}

function respond(entry, headers, ttl, cache) {
  const h = { ...headers, 'Content-Type': entry.type, 'X-Orbis-Cache': cache };
  if (entry.status === 200) h['Cache-Control'] = `public, max-age=${Math.min(ttl, 60)}`;
  if (entry.retryAfter) h['Retry-After'] = entry.retryAfter;
  return new Response(entry.body.slice(0), { status: entry.status, headers: h });
}
