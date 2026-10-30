// Weather field files for Orbis (Cloudflare Worker in front of an R2 bucket, free plan: 100,000 requests/day).
// Serves the OWX files written by scripts/wx-icon.py / .github/workflows/wx.yml (docs/WETTERDATEN-FORMAT.md)
// with CORS, conditional requests and byte ranges. Runs are immutable (the path contains the run), so
// browsers cache them for a year and one weather view costs only a handful of requests.
//
// Setup: Worker → Settings → Bindings → Add → R2 bucket, variable name `WX`, bucket = the weather bucket.
// The Worker address (https://<name>.<account>.workers.dev) is the repository variable WX_PUBLIC_URL.

const KEY = /^v1\/(latest\.json|\d{10}\/[a-z0-9_]+\/(o|t\d_\d)\.owx)$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, If-None-Match',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: CORS });

    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!KEY.test(key)) return new Response('Not found', { status: 404, headers: CORS });

    // R2 evaluates If-None-Match and Range from the request headers itself
    const obj = await (request.method === 'HEAD'
      ? env.WX.head(key)
      : env.WX.get(key, { onlyIf: request.headers, ...(request.headers.has('Range') && { range: request.headers }) }));
    if (!obj) return new Response('Not found', { status: 404, headers: CORS });

    const headers = new Headers(CORS);
    obj.writeHttpMetadata(headers);
    headers.set('ETag', obj.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'public, max-age=120');

    // a get() with a failed If-None-Match returns the object metadata without a body
    if (request.method === 'HEAD') return new Response(null, { headers });
    if (!('body' in obj)) return new Response(null, { status: 304, headers });
    if (request.headers.has('Range') && obj.range) {
      const { offset = 0, length = obj.size - offset } = obj.range;
      headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
      return new Response(obj.body, { status: 206, headers });
    }
    return new Response(obj.body, { headers });
  },
};
