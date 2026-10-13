// Minimal CORS proxy for the live flight data sources used by Orbis.
// Only needed if your browser cannot reach any of them directly.
//
// Deploy for free: dash.cloudflare.com → Workers & Pages → Create → "Hello World" worker,
// replace its code with this file, deploy, and paste the worker URL
// (https://<name>.<account>.workers.dev/) into Orbis → Einstellungen → Flugdaten-Proxy.

const ALLOWED_HOSTS = ['api.adsb.lol', 'opendata.adsb.fi', 'api.airplanes.live', 'opensky-network.org'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url') ?? '');
    } catch {
      return new Response('Missing or invalid ?url=', { status: 400, headers: CORS });
    }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: CORS });
    }

    const upstream = await fetch(target.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Orbis-Proxy/1.0' },
      cf: { cacheTtl: 5, cacheEverything: true },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'public, max-age=5' },
    });
  },
};
