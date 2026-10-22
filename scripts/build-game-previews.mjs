// Draws the preview pictures of the games hub (public/data/games/previews/*.svg) from countries.json.
//   node scripts/build-game-previews.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../public/data/games/', import.meta.url).pathname;
const OUT = DIR + 'previews/';
mkdirSync(OUT, { recursive: true });
const feats = JSON.parse(readFileSync(DIR + 'countries.json', 'utf8')).features;
const byEn = (n) => feats.find((f) => f.properties.en === n);
const W = 640, H = 400;

const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

/** SVG path of a feature, equirectangular, fitted to view [w, s, e, n] into W×H (aspect kept, centred) */
function makeProj([w, s, e, n], pad = 0) {
  const k = Math.min((W - 2 * pad) / (e - w), (H - 2 * pad) / (n - s));
  const ox = (W - k * (e - w)) / 2, oy = (H - k * (n - s)) / 2;
  return ([x, y]) => [(ox + (x - w) * k).toFixed(1), (oy + (n - y) * k).toFixed(1)];
}
function pathOf(f, proj, minSpan = 0) {
  let d = '';
  for (const poly of polys(f.geometry))
    for (const ring of poly.slice(0, 1)) {
      const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
      if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < minSpan) continue;
      let last = null;
      const pts = [];
      for (const p of ring) {
        const q = proj(p).map(Number);
        if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1.6) continue; // thin out: invisible at card size
        pts.push(q.map((v) => Math.round(v)).join(' '));
        last = q;
      }
      if (pts.length > 2) d += 'M' + pts.join('L') + 'Z';
    }
  return d;
}
function center(f) {
  let best = null, area = -1;
  for (const poly of polys(f.geometry)) {
    const r = poly[0], xs = r.map((q) => q[0]), ys = r.map((q) => q[1]);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > area) { area = a; best = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]; }
  }
  return best;
}

const defs = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
const save = (name, body) => writeFileSync(OUT + name + '.svg', svg(body));

// 1) Länder – world map, a few countries solved, one highlighted
{
  const proj = makeProj([-170, -58, 180, 82]);
  const hot = { Brazil: '#ffd23f', Germany: '#2fbf71', Australia: '#2fbf71', Canada: '#2fbf71', India: '#2fbf71', 'South Africa': '#2fbf71' };
  let body = defs('g', '#16244d', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  for (const f of feats) {
    if (!f.properties.sov || f.properties.en === 'Antarctica') continue;
    const c = hot[f.properties.en];
    body += `<path d="${pathOf(f, proj, 0.6)}" fill="${c ?? '#2a3a66'}" stroke="#0d1530" stroke-width="0.7" stroke-linejoin="round"/>`;
  }
  save('quiz', body);
}

// 2) Hauptstädte – Europe with pins
{
  const proj = makeProj([-14, 34, 42, 67], 10);
  let body = defs('g', '#1a2d5c', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  for (const f of feats) if (f.properties.cont === 'Europe' && f.properties.sov) body += `<path d="${pathOf(f, proj, 0.5)}" fill="#26365f" stroke="#0d1530" stroke-width="0.8" stroke-linejoin="round"/>`;
  const pins = ['France', 'Germany', 'Poland', 'Spain', 'Italy', 'Sweden', 'Ukraine', 'Greece', 'United Kingdom'];
  for (const n of pins) {
    const f = byEn(n);
    if (!f) continue;
    const [x, y] = proj(center(f));
    const hl = n === 'Germany';
    body += `<g transform="translate(${x} ${y})"><circle r="${hl ? 16 : 11}" fill="${hl ? '#ffd23f' : '#5b9dff'}" opacity="0.28"/><circle r="${hl ? 6.5 : 4.5}" fill="${hl ? '#ffd23f' : '#fff'}" stroke="#0d1530" stroke-width="1.5"/></g>`;
  }
  save('capitals', body);
}

// 3) Umrisse – one big silhouette
{
  const f = byEn('Italy');
  const bb = { w: 180, s: 90, e: -180, n: -90 };
  for (const poly of polys(f.geometry)) for (const [x, y] of poly[0]) { bb.w = Math.min(bb.w, x); bb.e = Math.max(bb.e, x); bb.s = Math.min(bb.s, y); bb.n = Math.max(bb.n, y); }
  const proj = makeProj([bb.w, bb.s, bb.e, bb.n], 34);
  const near = ['France', 'Switzerland', 'Austria', 'Slovenia', 'Croatia', 'Tunisia', 'Albania', 'Greece'].map(byEn).filter(Boolean);
  let body = defs('g', '#1c2f66', '#0a1126') + defs('s', '#8fc0ff', '#3f7fe8') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  body += `<g stroke="rgba(255,255,255,.06)" stroke-width="1">${[1, 2, 3, 4, 5].map((i) => `<path d="M${(i * W) / 6} 0V${H}M0 ${(i * H) / 6}H${W}"/>`).join('')}</g>`;
  for (const n of near) body += `<path d="${pathOf(n, proj)}" fill="#1e2c52" stroke="#0d1530" stroke-width="0.8"/>`;
  body += `<path d="${pathOf(f, proj)}" fill="url(#s)" stroke="#cfe3ff" stroke-width="1.4" stroke-linejoin="round" style="filter:drop-shadow(0 0 14px rgba(91,157,255,.55))"/>`;
  save('outline', body);
}

// 4) Straßen – stylised street view: road to the horizon, sky, signs, map pin
{
  let body = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6fd6"/><stop offset="1" stop-color="#bfe0ff"/></linearGradient>
    <linearGradient id="rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c6577"/><stop offset="1" stop-color="#2a2f3b"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <ellipse cx="470" cy="70" rx="70" ry="18" fill="#fff" opacity=".75"/><ellipse cx="150" cy="110" rx="90" ry="20" fill="#fff" opacity=".6"/>
    <path d="M0 215L90 175L170 205L250 160L330 200L420 170L520 205L640 175V240H0Z" fill="#6b8bb5"/>
    <path d="M0 235L120 205L220 230L330 200L450 232L560 210L640 230V250H0Z" fill="#46665a"/>
    <rect y="235" width="${W}" height="${H - 235}" fill="#4c7a48"/>
    <path d="M300 238H340L640 ${H}H0Z" fill="url(#rd)"/>
    <path d="M318 240L322 240L330 ${H}H310Z" fill="#f2c94c" opacity=".0"/>
    ${[0, 1, 2, 3, 4].map((i) => { const t = i / 4, y = 248 + t * t * 150, h = 4 + t * 22, w = 1.5 + t * 10; return `<rect x="${320 - w / 2}" y="${y}" width="${w}" height="${h}" fill="#f4f1e6"/>`; }).join('')}
    <path d="M300 238L0 ${H}H70L306 238Z" fill="#d9d9d9" opacity=".55"/><path d="M340 238L640 ${H}H570L334 238Z" fill="#d9d9d9" opacity=".55"/>
    <g fill="#2d3a2c"><rect x="86" y="165" width="12" height="80"/><circle cx="92" cy="150" r="34"/><rect x="520" y="175" width="10" height="70"/><circle cx="525" cy="162" r="28"/></g>
    <g><rect x="212" y="160" width="5" height="82" fill="#9aa3b2"/><rect x="186" y="150" width="58" height="34" rx="4" fill="#1b66c8" stroke="#fff" stroke-width="2.5"/><path d="M198 168H232M226 161l7 7-7 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g transform="translate(560 78)"><rect x="-42" y="-30" width="84" height="64" rx="12" fill="#0b1020" opacity=".78"/><path d="M-28 22L-10 4L4 14L16 -6L30 22Z" fill="#2a3a66"/><g transform="translate(12 -8)"><path d="M0 14C-9 2 -9 -12 0 -12S9 2 0 14Z" fill="#ff5a5f" transform="translate(0 0)"/><circle cy="-4" r="3" fill="#fff"/></g></g>`;
  // 360° badge: the street game shows panoramas
  save('street', body + `<g transform="translate(76 76)"><circle r="46" fill="#0b1020" opacity=".78"/><ellipse rx="46" ry="15" fill="none" stroke="#5b9dff" stroke-width="2.5" opacity=".9"/><text y="10" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="26" fill="#fff">360°</text></g>`);
}
// 5) Größe – France (blue) vs. Algeria (red) at the same scale, dashed frame + handle like the scale mode
{
  const KM = 111.195;
  const shapeOf = (f) => {
    const rings = polys(f.geometry).map((p) => p[0]).filter((r) => r.length > 20);
    const xs = rings.flat().map((p) => p[0]), ys = rings.flat().map((p) => p[1]);
    return { f, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  };
  const draw = (f, bb, ox, base, k, fill, stroke) => {
    const kx = Math.cos(((bb[1] + bb[3]) / 2) * Math.PI / 180);
    const pt = ([x, y]) => [Math.round(ox + (x - bb[0]) * kx * KM * k), Math.round(base - (y - bb[1]) * KM * k)].join(' ');
    // main land mass only (overseas parts of France would shrink the picture)
    const main = polys(f.geometry).map((p) => p[0]).filter((r) => r.some(([x, y]) => x > bb[0] && x < bb[2] && y > bb[1] && y < bb[3]));
    return { d: main.map((r) => 'M' + r.filter((_, i) => i % 2 === 0).map(pt).join('L') + 'Z').join(''), fill, stroke };
  };
  const fr = byEn('France'), dz = byEn('Algeria');
  const fb = [-5.2, 41.3, 9.6, 51.2], db = (() => { const s = shapeOf(dz); return s.bb; })();
  const k = 0.115;
  const fw = (fb[2] - fb[0]) * Math.cos(46 * Math.PI / 180) * KM * k, dh = (db[3] - db[1]) * KM * k;
  const base = 360, A = draw(fr, fb, 70, base, k, '#3b82f6', '#cfe3ff');
  const bx = 70 + fw + 70;
  const B = draw(dz, db, bx, base, k, '#ef4444', '#ffd0d0');
  const bw = (db[2] - db[0]) * Math.cos(28 * Math.PI / 180) * KM * k;
  let body = defs('g', '#1c2f66', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  body += `<line x1="30" y1="${base}" x2="${W - 30}" y2="${base}" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>`;
  body += `<path d="${A.d}" fill="${A.fill}" stroke="${A.stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  body += `<path d="${B.d}" fill="${B.fill}" stroke="${B.stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  body += `<rect x="${bx}" y="${base - dh}" width="${bw}" height="${dh}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  body += `<g transform="translate(${bx + bw} ${base - dh})"><circle r="11" fill="#ef4444" stroke="#fff" stroke-width="1.5"/><path d="M-4 4L4 -4M4 -1V-4H1M-4 1V4H-1" stroke="#fff" stroke-width="1.5" fill="none"/></g>`;
  save('size', body);
}
console.log('previews written to', OUT);

// 6) Gebiet-Auswahl – small world maps with the area highlighted (scope-*.svg), plus regions of one country
{
  const proj = makeProj([-170, -58, 180, 82]);
  const land = feats.filter((f) => f.properties.sov && f.properties.en !== 'Antarctica');
  const base = (fill) => land.map((f) => `<path d="${pathOf(f, proj, 2.5)}" fill="${fill(f)}" stroke="#0d1530" stroke-width="0.7" stroke-linejoin="round"/>`).join('');
  const bg = defs('g', '#16244d', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  const CONT = { Europe: 'europe', Asia: 'asia', Africa: 'africa', 'North America': 'north-america', 'South America': 'south-america', Oceania: 'oceania' };
  const COL = { Europe: '#5b9dff', Asia: '#f59e42', Africa: '#e5b93c', 'North America': '#2fbf71', 'South America': '#ef5da8', Oceania: '#a78bfa' };
  save('scope-world', bg + base(() => '#4a7ae0'));
  save('scope-continents', bg + base((f) => COL[f.properties.cont] ?? '#2a3a66'));
  for (const [c, slug] of Object.entries(CONT)) save('scope-' + slug, bg + base((f) => (f.properties.cont === c ? COL[c] : '#26335c')));
  // regions of a country: Germany's states in different blues
  const de = JSON.parse(readFileSync(DIR + 'admin1/DE.json', 'utf8')).features;
  const xs = [], ys = [];
  for (const f of de) for (const p of polys(f.geometry)) for (const [x, y] of p[0]) (xs.push(x), ys.push(y));
  const pr = makeProj([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 24);
  const pal = ['#3b6fd8', '#5b9dff', '#7fb3ff', '#2f58b0', '#4a86f0'];
  save('scope-regions', bg + de.map((f, i) => `<path d="${pathOf(f, pr)}" fill="${pal[i % pal.length]}" stroke="#0d1530" stroke-width="1.2" stroke-linejoin="round"/>`).join(''));
}

// 7) Regional-Auswahl – shape of every country made of its regions (previews/regions/<ISO>.svg)
{
  mkdirSync(OUT + 'regions/', { recursive: true });
  const idx = JSON.parse(readFileSync(DIR + 'admin1/index.json', 'utf8'));
  const pal = ['#3b6fd8', '#5b9dff', '#7fb3ff', '#2f58b0', '#4a86f0'];
  const RW = 320, RH = 200;
  let total = 0;
  for (const c of idx) {
    let fs;
    try { fs = JSON.parse(readFileSync(DIR + `admin1/${c.id}.json`, 'utf8')).features; } catch { continue; }
    const rings = [];
    fs.forEach((f, i) => { for (const poly of polys(f.geometry)) rings.push({ i, r: poly[0] }); });
    const wrap = rings.some(({ r }) => r.some(([x]) => x > 170)) && rings.some(({ r }) => r.some(([x]) => x < -170));
    const fx = (x) => (wrap && x < 0 ? x + 360 : x);
    const box = (r) => { const xs = r.map((p) => fx(p[0])), ys = r.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    // keep the main land mass: cluster the polygons (bbox gap < 4°), take the biggest cluster by real area and
    // the clusters that are big enough and close to it – so Alaska/Hawaii/Guyane don't shrink the shape
    const shoelace = (r) => { let t = 0; for (let i = 0; i < r.length - 1; i++) t += fx(r[i][0]) * r[i + 1][1] - fx(r[i + 1][0]) * r[i][1]; return Math.abs(t / 2) * Math.cos((r[0][1] * Math.PI) / 180); };
    const withBox = rings.map((o) => ({ ...o, b: box(o.r), a: shoelace(o.r) }));
    const par = withBox.map((_, i) => i);
    const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    const GAP = 4;
    for (let i = 0; i < withBox.length; i++) for (let j = i + 1; j < withBox.length; j++) {
      const A = withBox[i].b, B = withBox[j].b;
      if (A[0] - GAP <= B[2] && B[0] - GAP <= A[2] && A[1] - GAP <= B[3] && B[1] - GAP <= A[3]) par[find(i)] = find(j);
    }
    const clusters = new Map();
    withBox.forEach((o, i) => { const k = find(i); const c = clusters.get(k) ?? { items: [], a: 0, b: [999, 999, -999, -999] }; c.items.push(o); c.a += o.a; c.b = [Math.min(c.b[0], o.b[0]), Math.min(c.b[1], o.b[1]), Math.max(c.b[2], o.b[2]), Math.max(c.b[3], o.b[3])]; clusters.set(k, c); });
    const list = [...clusters.values()].sort((x, y) => y.a - x.a);
    const main = list[0];
    const mc = [(main.b[0] + main.b[2]) / 2, (main.b[1] + main.b[3]) / 2];
    const dim = Math.max(main.b[2] - main.b[0], main.b[3] - main.b[1]);
    const keep = list.filter((c) => c === main || (c.a >= main.a * 0.04 && Math.hypot(((c.b[0] + c.b[2]) / 2 - mc[0]) * Math.cos((mc[1] * Math.PI) / 180), (c.b[1] + c.b[3]) / 2 - mc[1]) <= dim * 0.8)).flatMap((c) => c.items);
    const bb = [Math.min(...keep.map((o) => o.b[0])), Math.min(...keep.map((o) => o.b[1])), Math.max(...keep.map((o) => o.b[2])), Math.max(...keep.map((o) => o.b[3]))];
    const pad = 14, k = Math.min((RW - 2 * pad) / ((bb[2] - bb[0]) * Math.cos(((bb[1] + bb[3]) / 2) * Math.PI / 180) || 1), (RH - 2 * pad) / (bb[3] - bb[1] || 1));
    const kx = k * Math.cos(((bb[1] + bb[3]) / 2) * Math.PI / 180);
    const ox = (RW - kx * (bb[2] - bb[0])) / 2, oy = (RH - k * (bb[3] - bb[1])) / 2;
    const pj = ([x, y]) => [ox + (fx(x) - bb[0]) * kx, oy + (bb[3] - y) * k];
    let body = '';
    const byRegion = new Map();
    for (const o of keep) {
      let last = null, pts = [];
      for (const p of o.r) {
        const q = pj(p);
        if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1.3) continue;
        pts.push(q.map(Math.round).join(' '));
        last = q;
      }
      if (pts.length > 2) byRegion.set(o.i, (byRegion.get(o.i) ?? '') + 'M' + pts.join('L') + 'Z');
    }
    for (const [i, d] of byRegion) body += `<path d="${d}" fill="${pal[i % pal.length]}" stroke="#0d1530" stroke-width="1" stroke-linejoin="round"/>`;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RW} ${RH}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
    writeFileSync(OUT + `regions/${c.id}.svg`, out);
    total += out.length;
  }
  console.log('region shapes:', idx.length, Math.round(total / 1024) + ' KB');
}

// 8) Higher Lower – Italy vs. Greenland with a VS badge (previews/higherlower.svg)
{
  const fit = (f, [x0, y0, x1, y1], fill, stroke) => {
    const rings = polys(f.geometry).map((p) => p[0]).filter((r) => r.length > 12);
    const pts = rings.flat();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const w = Math.min(...xs), e = Math.max(...xs), s = Math.min(...ys), n = Math.max(...ys);
    const kx = Math.cos(((s + n) / 2) * Math.PI / 180);
    const k = Math.min((x1 - x0) / ((e - w) * kx), (y1 - y0) / (n - s));
    const ox = x0 + ((x1 - x0) - (e - w) * kx * k) / 2, oy = y0 + ((y1 - y0) - (n - s) * k) / 2;
    let d = '';
    for (const r of rings) {
      let last = null, q = [];
      for (const p of r) {
        const a = [ox + (p[0] - w) * kx * k, oy + (n - p[1]) * k];
        if (last && Math.hypot(a[0] - last[0], a[1] - last[1]) < 1.2) continue;
        q.push(a.map((v) => Math.round(v)).join(' '));
        last = a;
      }
      if (q.length > 2) d += 'M' + q.join('L') + 'Z';
    }
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`;
  };
  const body = defs('g', '#1c2f66', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`
    + fit(byEn('Italy'), [40, 40, 290, 360], '#5b9dff', '#cfe3ff')
    + fit(byEn('Greenland'), [350, 40, 600, 360], '#ef4444', '#ffd0d0')
    + `<circle cx="320" cy="200" r="40" fill="#0d1530" stroke="rgba(255,255,255,.7)" stroke-width="4"/><text x="320" y="214" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="38" fill="#fff">VS</text>`;
  save('higherlower', body);
  // Maßstab: Greenland stays as it is, Italy sits in a dashed frame with a drag handle
  const sc = defs('g', '#1c2f66', '#0a1126') + `<rect width="${W}" height="${H}" fill="url(#g)"/>`
    + fit(byEn('Greenland'), [30, 40, 300, 360], '#2a3a66', '#3d4f82')
    + `<rect x="330" y="70" width="280" height="260" rx="6" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="12 9"/>`
    + fit(byEn('Italy'), [380, 110, 540, 290], '#5b9dff', '#cfe3ff')
    + `<circle cx="610" cy="330" r="14" fill="#fff" stroke="#0d1530" stroke-width="3"/>`;
  save('scale', sc);
}
