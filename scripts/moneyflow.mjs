// Pre-builds the "Geldflüsse" dataset for the Zeitzeugen-Karte layer.
//
// Merges the per-congress-member money records of whofundedgenocide.com (who funds the pro-Israel
// lobby and whom it funds, built from FEC filings) with centroids of the congressional districts
// (unitedstates/districts 2012 shapes – exact enough as a dot position).
//
// Outputs: public/data/moneyflow.json
//
// Usage: node scripts/moneyflow.mjs            (needs Node >= 18, global fetch)
//
// Data: whofundedgenocide.com (FEC bulk filings, residential addresses removed),
//       district shapes © unitedstates.io (public domain, US Census cartography).

import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'public/data/moneyflow.json';
const MEMBERS_URL = 'https://whofundedgenocide.com/data/reconciliation.json';
const EMBED_URL = 'https://whofundedgenocide.com/';
const CENTROID_BASE = 'https://raw.githubusercontent.com/unitedstates/districts/gh-pages/cds/2012/';
const LIST_URL = 'https://api.github.com/repos/unitedstates/districts/contents/cds/2012?ref=gh-pages';

const HEADERS = {
  'User-Agent': 'Orbis-moneyflow-builder/1.0 (https://github.com/malte9799/orbis)',
};
const CONCURRENCY = 10;
const R = Math.PI / 180;

/** area-weighted centroid of a ring (shoelace, planar in lon/lat – fine for district dots) */
function ringCentroid(ring) {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a2) < 1e-12) {
    // degenerate: mean of the vertices
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring.slice(0, -1)) (sx += x), (sy += y);
    return [sx / (ring.length - 1), sy / (ring.length - 1)];
  }
  const a = a2 / 2;
  return [cx / (6 * a), cy / (6 * a)];
}

/** area of a ring (for choosing the largest polygon of multi-part shapes) */
function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(s) / 2;
}

/** centroid of a (Multi)Polygon: point of its largest ring */
function shapeCentroid(geom) {
  if (geom.type === 'Point') return geom.coordinates;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let best = null;
  let bestA = 0;
  for (const poly of polys) {
    const a = ringArea(poly[0]);
    if (a > bestA) ((best = poly[0]), (bestA = a));
  }
  if (!best) {
    // very small offshore/atoll districts: mean of all points of the first part
    const p = polys[0][0];
    let sx = 0;
    let sy = 0;
    for (const [x, y] of p) (sx += x), (sy += y);
    return [sx / p.length, sy / p.length];
  }
  return ringCentroid(best);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]).catch(() => null);
    }
  });
  await Promise.all(workers);
  return out;
}

// 2021/2022 district limit changes, whose shapes are not yet in the 2012 branch: known approximate centroids
const ROUGH = {
  'CO-8': [-104.97, 39.91], // Denver-Vororte nördlich
  'FL-28': [-80.5, 25.6], // Homestead / Süddade
  'MT-1': [-113.5, 46.9], // Westmontana
  'MT-2': [-108.5, 47.1], // Ostmontana
  'NC-14': [-81.2, 35.28], // Charlotte (SW)
  'OR-6': [-123.03, 44.94], // Salem / nördlich
  'TX-37': [-97.72, 30.28], // Austin (Zentrum)
  'TX-38': [-95.75, 29.79], // Houston (Nordwest)
};

const json = async (url) => {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} – ${url}`);
  return r.json();
};

/** the page embeds the same records with "backers" (PAC names) in <script id="data"> – optional */
async function embedByMember() {
  try {
    const html = await (await fetch(EMBED_URL, { headers: HEADERS })).text();
    const m = /<script id="data" type="application\/json">([^<]+)<\/script>/.exec(html);
    if (!m) return {};
    const data = JSON.parse(m[1]);
    const out = {};
    for (const mem of data.members ?? []) if (mem.name && Array.isArray(mem.backers) && mem.backers.length) out[mem.name] = { backers: mem.backers };
    return out;
  } catch {
    return {};
  }
}

// whofundedgenocide stores at-large districts as "XX-AL", the shapes as "XX-0"; senators (-SEN) get no dot
const shapeKey = (district) => {
  if (!district || !/^[A-Z]{2}-/.test(district)) return null;
  const [st, n] = district.split('-');
  if (n === 'SEN') return null;
  const num = n === 'AL' ? 0 : Number(n);
  if (!Number.isInteger(num)) return null;
  return `${st}-${num}`;
};

const main = async () => {
  console.log('→ members (whofundedgenocide.com /data/reconciliation.json) …');
  const members = await json(MEMBERS_URL);
  if (!Array.isArray(members) || !members.length) throw new Error('reconciliation.json leer / Schema geändert');
  const key0 = Object.keys(members[0]);
  const has = (k) => key0.includes(k);
  const back = await embedByMember();

  console.log('→ district list (unitedstates/districts) …');
  const listing = await json(LIST_URL);
  const dirs = new Set(listing.map((x) => x.name));
  const need = [...new Set(members.map((m) => shapeKey(m.district)).filter(Boolean))].filter((d) => {
    if (dirs.has(d) || ROUGH[d]) return true;
    console.log(`  fehlender Bezirk: ${d}`);
    return false;
  });
  console.log(`  ${need.length} Bezirks-Centroids laden …`);

  const cents = await pool(need, CONCURRENCY, async (d) => {
    if (ROUGH[d]) return [d, ROUGH[d]] ?? null;
    const f = await json(CENTROID_BASE + encodeURIComponent(d) + '/shape.geojson');
    const xy = shapeCentroid(f.geometry ?? f);
    if (!Number.isFinite(xy[0]) || !Number.isFinite(xy[1]) || Math.hypot(xy[1], xy[0]) === 0) return null;
    return [d, [significant(xy[0]), significant(xy[1])]];
  });
  const byDistrict = Object.fromEntries(cents.filter(Boolean));

  const rows = members
    .map((m) => {
      const xy = byDistrict[shapeKey(m.district)];
      if (!xy) return null;
      const row = {
        n: String(m.name),
        p: String(m.party ?? ''),
        d: String(m.district),
        lon: xy[0],
        lat: xy[1],
        don: num(m[has('donations') ? 'donations' : 'don']) ?? 0,
        ie: num(m[has('ie') ? 'ie' : 'fec_ie_against']) ?? 0,
        aipac: num(m.fec_aipac ?? m.aipac) ?? 0,
      };
      const b = back[m.name];
      if (b) row.backers = b.backers;
      return row;
    })
    .filter(Boolean);

  const out = {
    built: new Date().toISOString().slice(0, 10),
    source: 'whofundedgenocide.com (FEC bulk filings) · Bezirkslage: unitedstates/districts (2012)',
    members: rows,
  };
  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT, JSON.stringify(out).replace(/},\[/g, '},\n['));
  console.log(`✓ ${OUT}: ${rows.length} Abgeordnete mit Positions- und Geldangaben`);
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(+v) ? +v : null);
const significant = (x) => Math.round(x * 1e5) / 1e5;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
