// Builds the static geodata for the games (public/data/games/) from Natural Earth (public domain).
//   node scripts/build-games-data.mjs <dir with ne_50m_admin_0_countries.geojson + ne_10m_admin_1_states_provinces.geojson>
// Output: countries.json (all countries) and admin1/<ISO_A2>.json (one file per country with ≥ 3 regions).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [IN, FLAGS] = process.argv.slice(2); // NE dir also holds ne_50m_populated_places.geojson (capitals)
if (!IN) throw new Error('usage: build-games-data <naturalEarthDir> [flag-icons/flags/4x3]');
const OUT = new URL('../public/data/games/', import.meta.url).pathname;
mkdirSync(join(OUT, 'admin1'), { recursive: true });
mkdirSync(join(OUT, 'flags'), { recursive: true });

// Douglas-Peucker on a ring/line; tol in degrees
function dp(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (!len) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol * tol) { keep[idx] = 1; st.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r = (n) => Math.round(n * 100) / 100;
function ring(ring, tol) {
  let s = dp(ring, tol).map(([x, y]) => [r(x), r(y)]);
  if (s.length < 4) s = dp(ring, tol / 10).map(([x, y]) => [r(x), r(y)]); // tiny states: keep a rough outline
  return s.length >= 4 ? s : null;
}
function geom(g, tol, minArea) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const out = [];
  for (const p of polys) {
    const outer = ring(p[0], tol);
    if (!outer) continue;
    // drop specks, but keep at least the biggest part
    let a = 0;
    for (let i = 0; i < outer.length - 1; i++) a += outer[i][0] * outer[i + 1][1] - outer[i + 1][0] * outer[i][1];
    out.push({ poly: [outer, ...p.slice(1).map((h) => ring(h, tol)).filter(Boolean)], area: Math.abs(a / 2) });
  }
  out.sort((x, y) => y.area - x.area);
  const kept = out.filter((o, i) => i === 0 || o.area >= minArea).map((o) => o.poly);
  return kept.length === 1 ? { type: 'Polygon', coordinates: kept[0] } : { type: 'MultiPolygon', coordinates: kept };
}
const read = (f) => JSON.parse(readFileSync(join(IN, f), 'utf8'));

// ---- countries (sovereign states + the larger dependencies) -----------------
const countries = read('ne_50m_admin_0_countries.geojson');
const isoOf = (p) => (p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ADM0_ISO);
const cf = countries.features
  .filter((f) => f.properties.TYPE !== 'Lease' && f.properties.NAME !== 'Antarctica')
  .map((f, i) => {
    const p = f.properties;
    return {
      type: 'Feature',
      properties: { id: String(i), iso: isoOf(p), a3: p.ADM0_A3, name: p.NAME_DE || p.NAME, en: p.NAME_EN || p.NAME, cont: p.CONTINENT, sub: p.SUBREGION, pop: p.POP_EST, sov: p.TYPE === 'Sovereign country' || p.TYPE === 'Country' ? 1 : 0 },
      geometry: geom(f.geometry, 0.02, 0),
    };
  })
  .filter((f) => f.geometry.coordinates.length);
// capitals (Natural Earth populated places): main capital first, then alternates
const caps = new Map();
for (const f of read('ne_50m_populated_places.geojson').features) {
  const p = f.properties;
  if (p.FEATURECLA !== 'Admin-0 capital' && p.FEATURECLA !== 'Admin-0 capital alt') continue;
  if (!caps.has(p.ADM0_A3)) caps.set(p.ADM0_A3, []);
  caps.get(p.ADM0_A3)[p.FEATURECLA === 'Admin-0 capital' ? 'unshift' : 'push']({ de: p.NAME_DE || p.NAME, en: p.NAME_EN || p.NAME });
}
// Natural Earth lacks a few capitals and lists some seats in an odd order
const EXTRA = { 'South Sudan': { de: 'Juba', en: 'Juba' }, Nauru: { de: 'Yaren', en: 'Yaren' } };
const FIRST = { Tanzania: 'Dodoma', 'South Africa': 'Pretoria' };
for (const f of cf) {
  const c = caps.get(f.properties.a3) ?? (EXTRA[f.properties.en] ? [EXTRA[f.properties.en]] : undefined);
  if (c && FIRST[f.properties.en]) c.sort((a, b) => (b.en === FIRST[f.properties.en]) - (a.en === FIRST[f.properties.en]));
  if (c) { f.properties.cap = c.map((x) => x.de); f.properties.capEn = c.map((x) => x.en); }
}
// flags (flag-icons, MIT) for sovereign states: properties.flag = file name without extension
if (FLAGS)
  for (const f of cf) {
    const p = f.properties;
    const code = (p.iso === 'CN-TW' ? 'tw' : p.iso).toLowerCase();
    if (p.sov && existsSync(join(FLAGS, `${code}.svg`))) {
      copyFileSync(join(FLAGS, `${code}.svg`), join(OUT, 'flags', `${code}.svg`));
      p.flag = code;
    }
  }
writeFileSync(join(OUT, 'countries.json'), JSON.stringify({ type: 'FeatureCollection', features: cf }));
console.log('countries', cf.length);

// ---- admin-1 per country -----------------------------------------------------
const a1 = read('ne_10m_admin_1_states_provinces.geojson');
const by = new Map();
for (const f of a1.features) {
  const p = f.properties;
  const iso = p.iso_a2 && p.iso_a2 !== '-99' ? p.iso_a2 : p.adm0_a3;
  if (!by.has(iso)) by.set(iso, { admin: p.admin, list: [] });
  by.get(iso).list.push(f);
}
const index = [];
for (const [iso, { admin, list }] of by) {
  if (list.length < 3) continue;
  const features = list.map((f, i) => ({
    type: 'Feature',
    properties: { id: String(i), name: f.properties.name_de || f.properties.name, en: f.properties.name_en || f.properties.name, type: f.properties.type_en || '' },
    geometry: geom(f.geometry, 0.015, 0.002),
  })).filter((f) => f.geometry.coordinates.length);
  writeFileSync(join(OUT, 'admin1', `${iso}.json`), JSON.stringify({ type: 'FeatureCollection', features }));
  const nm = cf.find((c) => c.properties.iso === iso && c.properties.sov)?.properties.name ?? admin;
  if (features.length >= 3) index.push({ id: iso, name: nm, n: features.length });
}
index.sort((a, b) => b.n - a.n);
writeFileSync(join(OUT, 'admin1/index.json'), JSON.stringify(index));
console.log('admin1 countries', index.length);
