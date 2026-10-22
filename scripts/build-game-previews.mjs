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
  save('street', body);
}
console.log('previews written to', OUT);
