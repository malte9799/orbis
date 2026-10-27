// Camera viewing directions for Orbis (Cloudflare Worker + KV, free plan).
//
// Corrected viewing directions of webcams: the map reads them (GET /dirs) and draws the view cone and
// the 3D board with them; the right-hand camera panel writes them. Writing needs the admin token.
//
// Setup (see "Kamera-Richtungen" in README.md):
//   1. Workers & Pages → KV → create a namespace, bind it to the worker as CAMDIR
//   2. Settings → Variables and Secrets: secret ADMIN_TOKEN (a long random string),
//      optional variable ALLOWED_ORIGINS (comma separated, e.g. https://malte9799.github.io)
//
// Routes
//   GET    /dirs                  → { dirs: { "<camera key>": { d: 0..359, at: <ms> } } }
//   PUT    /dirs   {key, dir}     → sets one direction            (Authorization: Bearer <ADMIN_TOKEN>)
//   DELETE /dirs?key=<key>        → removes the correction        (Authorization: Bearer <ADMIN_TOKEN>)
//
// Prepared for suggestions by every visitor (later): POST /suggest would store into a separate KV key
// ("suggestions") with a rate limit; the admin accepts them with the PUT above. The GET answer and
// the client do not change for that.

const KEY = 'dirs';
const MAX_ENTRIES = 20000;
const KEY_RE = /^[\w.:@,|/ -]{1,120}$/;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const json = (body, status, headers, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers, ...extra } });

// compare hashes, so the length of the token does not leak through timing
async function sameToken(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

async function isAdmin(request, env) {
  const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_TOKEN && !!given && (await sameToken(given, env.ADMIN_TOKEN));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && origin && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403, headers: cors(origin) });
    const headers = cors(allowed.length ? origin : '*');
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    const url = new URL(request.url);
    if (!url.pathname.endsWith('/dirs')) return json({ error: 'not found' }, 404, headers);
    if (!env.CAMDIR) return json({ error: 'KV namespace CAMDIR is not bound' }, 500, headers);

    const read = async () => (await env.CAMDIR.get(KEY, 'json')) ?? {};

    if (request.method === 'GET') return json({ dirs: await read() }, 200, headers, { 'Cache-Control': 'public, max-age=60' });

    if (request.method !== 'PUT' && request.method !== 'DELETE') return json({ error: 'method not allowed' }, 405, headers);
    if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401, headers);

    if (request.method === 'DELETE') {
      const key = url.searchParams.get('key') ?? '';
      if (!KEY_RE.test(key)) return json({ error: 'bad key' }, 400, headers);
      const dirs = await read();
      delete dirs[key];
      await env.CAMDIR.put(KEY, JSON.stringify(dirs));
      return json({ ok: true }, 200, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad json' }, 400, headers);
    }
    const dir = Number(body?.dir);
    if (!KEY_RE.test(String(body?.key ?? '')) || !Number.isFinite(dir) || dir < 0 || dir >= 360) return json({ error: 'bad key or dir' }, 400, headers);
    const dirs = await read();
    if (!(body.key in dirs) && Object.keys(dirs).length >= MAX_ENTRIES) return json({ error: 'too many entries' }, 413, headers);
    dirs[body.key] = { d: Math.round(dir * 10) / 10, at: Date.now() };
    await env.CAMDIR.put(KEY, JSON.stringify(dirs));
    return json({ ok: true }, 200, headers);
  },
};
